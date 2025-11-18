import chalk from 'chalk';
import { TContext } from '../lib/context';
import { SCOPE } from '../lib/engine/scope_spec';
import { runGitCommand } from '../lib/git/runner';
import {
  PreconditionsFailedError,
  BlockedDuringRebaseError,
} from '../lib/errors';
import { parseDiffIntoHunks, Hunk } from '../lib/utils/diff_parser';
import { findTargetCommit, Commit } from '../lib/utils/blame_matcher';
import { restackBranches } from './restack';

export async function absorbAction(
  opts: {
    dryRun: boolean;
    force: boolean;
    all: boolean;
    patch: boolean;
  },
  context: TContext
): Promise<void> {
  // Pre-flight checks
  if (context.engine.rebaseInProgress()) {
    throw new BlockedDuringRebaseError();
  }

  const currentBranch = context.engine.currentBranchPrecondition;

  // Check if branch is tracked
  if (!context.engine.isBranchTracked(currentBranch)) {
    throw new PreconditionsFailedError(
      `Branch ${chalk.cyan(currentBranch)} is not tracked. Run ${chalk.cyan(
        'gt track'
      )} first.`
    );
  }

  // Stage changes if requested
  if (opts.all) {
    context.engine.addAll();
  } else if (opts.patch) {
    // Run git add --patch interactively
    runGitCommand({
      args: ['add', '--patch'],
      options: { stdio: 'inherit' },
      onError: 'throw',
    });
  }

  // Check for staged changes by getting diff between index and HEAD
  const stagedDiff = runGitCommand({
    args: ['diff', '--cached'],
    onError: 'throw',
  });

  if (!stagedDiff || stagedDiff.trim().length === 0) {
    throw new PreconditionsFailedError(
      'No staged changes to absorb. Stage changes with git add or use --all flag.'
    );
  }

  context.splog.info('Analyzing staged changes...');

  // Parse diff into hunks
  const hunks = parseDiffIntoHunks(stagedDiff);
  if (hunks.length === 0) {
    throw new PreconditionsFailedError('No hunks found in staged changes.');
  }

  // Get downstack commits and match hunks
  const { commits, hunkToCommitMap, unmatchedHunks } = matchHunksToCommits(
    hunks,
    currentBranch,
    context
  );

  if (hunkToCommitMap.size === 0) {
    context.splog.warn('No hunks could be matched to downstack commits.');
    context.splog.tip(
      'Hunks can only be absorbed if they modify lines that were introduced by commits in the current stack.'
    );
    return;
  }

  // Display plan
  displayAbsorbPlan({ hunkToCommitMap, unmatchedHunks, commits }, context);

  // Confirm (unless --force or --dry-run)
  if (!opts.force && !opts.dryRun && context.interactive) {
    const response = await context.prompts({
      type: 'confirm',
      name: 'confirmed',
      message: 'Absorb these changes?',
      initial: true,
    });
    if (!response.confirmed) {
      context.splog.info('Aborted.');
      return;
    }
  }

  // Exit if dry-run
  if (opts.dryRun) {
    context.splog.info(
      chalk.cyan('Dry run complete. Run without --dry-run to apply.')
    );
    return;
  }

  // Apply fixups and rebase
  applyAndRebase({ hunkToCommitMap, commits, currentBranch }, context);
}

/**
 * Match hunks to commits in the downstack.
 */
function matchHunksToCommits(
  hunks: Hunk[],
  currentBranch: string,
  context: TContext
): {
  commits: Commit[];
  hunkToCommitMap: Map<string, Hunk[]>;
  unmatchedHunks: Hunk[];
} {
  // Get downstack commits (excluding current branch)
  const downstackBranches = context.engine.getRelativeStack(currentBranch, {
    recursiveParents: true,
    currentBranch: false,
    recursiveChildren: false,
  });

  // If no downstack branches, get commits from parent branch directly
  const commits =
    downstackBranches.length > 0
      ? getCommitsFromBranches(downstackBranches, context)
      : getCommitsFromParent(currentBranch, context);

  if (commits.length === 0) {
    throw new PreconditionsFailedError(
      'No commits in downstack to absorb into. The current branch must have parent commits.'
    );
  }

  // Match hunks to commits
  const hunkToCommitMap = new Map<string, Hunk[]>();
  const unmatchedHunks: Hunk[] = [];

  for (const hunk of hunks) {
    const targetCommit = findTargetCommit(hunk, commits);
    if (targetCommit) {
      const key = targetCommit.sha;
      if (!hunkToCommitMap.has(key)) {
        hunkToCommitMap.set(key, []);
      }
      hunkToCommitMap.get(key)!.push(hunk);
    } else {
      unmatchedHunks.push(hunk);
    }
  }

  return { commits, hunkToCommitMap, unmatchedHunks };
}

/**
 * Apply fixup commits, rebase, and restack.
 */
function applyAndRebase(
  params: {
    hunkToCommitMap: Map<string, Hunk[]>;
    commits: Commit[];
    currentBranch: string;
  },
  context: TContext
): void {
  const { hunkToCommitMap, commits, currentBranch } = params;
  // Apply fixups
  context.splog.info('Creating fixup commits...');
  const fixupCommits = applyFixups(hunkToCommitMap, commits, context);

  // Autosquash rebase
  context.splog.info('Rebasing and squashing fixups...');
  autosquashRebase(commits, context);

  // Restack upstack branches
  const upstackBranches = context.engine.getRelativeStack(
    currentBranch,
    SCOPE.UPSTACK_EXCLUSIVE
  );
  if (upstackBranches.length > 0) {
    context.splog.info('Restacking upstack branches...');
    restackBranches(upstackBranches, context);
  }

  context.splog.info(
    chalk.green(
      `✓ Successfully absorbed changes into ${fixupCommits.length} commit${
        fixupCommits.length === 1 ? '' : 's'
      }.`
    )
  );
}

/**
 * Get commits from the parent branch of the current branch.
 */
function getCommitsFromParent(
  currentBranch: string,
  context: TContext
): Commit[] {
  const parentBranch = context.engine.getParentOrPrev(currentBranch);
  return getCommitsFromBranches([parentBranch], context);
}

/**
 * Get all commits from the given branches in order (oldest to newest).
 * Includes all commits up to and including each branch head.
 */
function getCommitsFromBranches(
  branches: string[],
  _context: TContext
): Commit[] {
  const commits: Commit[] = [];
  const seenShas = new Set<string>();

  for (const branch of branches) {
    // Get all commits in this branch (from trunk to branch head)
    const branchCommits = runGitCommand({
      args: ['rev-list', '--reverse', branch],
      onError: 'throw',
    })
      .trim()
      .split('\n')
      .filter((s) => s.length > 0);

    for (const commitSha of branchCommits) {
      // Skip if we've already seen this commit
      if (seenShas.has(commitSha)) continue;
      seenShas.add(commitSha);

      const subject = runGitCommand({
        args: ['log', '-1', '--format=%s', commitSha],
        onError: 'throw',
      }).trim();

      commits.push({ sha: commitSha, subject });
    }
  }

  return commits;
}

/**
 * Display the absorption plan to the user.
 */
function displayAbsorbPlan(
  plan: {
    hunkToCommitMap: Map<string, Hunk[]>;
    unmatchedHunks: Hunk[];
    commits: Commit[];
  },
  context: TContext
): void {
  const { hunkToCommitMap, unmatchedHunks, commits } = plan;
  context.splog.info(
    `Found ${chalk.cyan(hunkToCommitMap.size.toString())} commit${
      hunkToCommitMap.size === 1 ? '' : 's'
    } to absorb into:\n`
  );

  // Create a map for quick commit lookup
  const commitMap = new Map(commits.map((c) => [c.sha, c]));

  for (const [sha, hunks] of hunkToCommitMap) {
    const commit = commitMap.get(sha);
    if (commit) {
      context.splog.info(
        `  ${chalk.yellow(sha.substring(0, 7))} ${chalk.dim(commit.subject)}`
      );
      for (const hunk of hunks) {
        context.splog.info(
          `    • ${hunk.file} (lines ${hunk.oldStart}-${
            hunk.oldStart + hunk.oldLines - 1
          })`
        );
      }
      context.splog.info('');
    }
  }

  if (unmatchedHunks.length > 0) {
    context.splog.warn(
      `${chalk.yellow('⚠')} ${unmatchedHunks.length} hunk${
        unmatchedHunks.length === 1 ? '' : 's'
      } could not be matched (will remain staged):\n`
    );
    for (const hunk of unmatchedHunks) {
      context.splog.info(
        `  • ${hunk.file} (lines ${hunk.newStart}-${
          hunk.newStart + hunk.newLines - 1
        })`
      );
    }
    context.splog.info('');
  }
}

/**
 * Apply fixup commits for each target commit.
 */
function applyFixups(
  hunkToCommitMap: Map<string, Hunk[]>,
  commits: Commit[],
  context: TContext
): string[] {
  const fixupCommits: string[] = [];
  const commitMap = new Map(commits.map((c) => [c.sha, c]));

  // Save the current staged changes
  runGitCommand({
    args: ['stash', 'push', '--keep-index', '-m', 'absorb-temp-stash'],
    onError: 'throw',
  });

  try {
    // Reset the index
    runGitCommand({
      args: ['reset', 'HEAD'],
      onError: 'throw',
    });

    for (const [sha, hunks] of hunkToCommitMap) {
      const commit = commitMap.get(sha);
      if (!commit) continue;

      // Apply each hunk's patch to the index
      for (const hunk of hunks) {
        try {
          runGitCommand({
            args: ['apply', '--cached', '--unidiff-zero'],
            options: { input: hunk.patch },
            onError: 'throw',
          });
        } catch (error) {
          context.splog.warn(
            `Failed to apply hunk in ${hunk.file}, skipping...`
          );
        }
      }

      // Create fixup commit
      const fixupMessage = `fixup! ${commit.subject}`;
      runGitCommand({
        args: ['commit', '-m', fixupMessage, '--no-verify'],
        onError: 'throw',
      });

      const fixupSha = runGitCommand({
        args: ['rev-parse', 'HEAD'],
        onError: 'throw',
      }).trim();
      fixupCommits.push(fixupSha);

      // Reset index for next iteration
      runGitCommand({
        args: ['reset', 'HEAD'],
        onError: 'throw',
      });
    }
  } finally {
    // Restore any remaining staged changes
    try {
      runGitCommand({
        args: ['stash', 'pop'],
        onError: 'ignore',
      });
    } catch {
      // Ignore errors if stash is empty
    }
  }

  return fixupCommits;
}

/**
 * Run interactive rebase with autosquash to merge fixup commits.
 */
function autosquashRebase(commits: Commit[], _context: TContext): void {
  if (commits.length === 0) return;

  // Get the parent of the first commit in our downstack
  const baseCommit = `${commits[0].sha}^`;

  runGitCommand({
    args: [
      'rebase',
      '--interactive',
      '--autosquash',
      '--keep-empty',
      baseCommit,
    ],
    options: {
      env: { ...process.env, GIT_SEQUENCE_EDITOR: 'true' },
    },
    onError: 'throw',
  });
}
