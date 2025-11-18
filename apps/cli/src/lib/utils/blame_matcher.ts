import { runGitCommand } from '../git/runner';
import { Hunk } from './diff_parser';

export interface Commit {
  sha: string;
  subject: string;
}

/**
 * Find which commit in the provided list last touched the lines
 * that are being modified in this hunk.
 *
 * Returns null if no clear match is found (ambiguous or not in the commit list).
 */
export function findTargetCommit(hunk: Hunk, commits: Commit[]): Commit | null {
  // Skip hunks with no old lines (new file additions)
  if (hunk.oldLines === 0) {
    return null;
  }

  try {
    // Run git blame on the range of lines being modified
    const blameOutput = runGitCommand({
      args: [
        'blame',
        '--porcelain',
        '-L',
        `${hunk.oldStart},${hunk.oldStart + hunk.oldLines - 1}`,
        'HEAD',
        '--',
        hunk.file,
      ],
      onError: 'throw',
    });

    // Parse blame output to extract commit SHAs
    const blamedShas = parseBlameOutput(blameOutput);

    // Find the most recent commit in our downstack that touched these lines
    // We iterate in reverse order (most recent first)
    for (const commit of [...commits].reverse()) {
      if (blamedShas.has(commit.sha)) {
        return commit;
      }
    }

    return null;
  } catch (error) {
    // If blame fails (e.g., file doesn't exist at HEAD), skip this hunk
    return null;
  }
}

/**
 * Parse git blame --porcelain output to extract unique commit SHAs.
 */
function parseBlameOutput(blameOutput: string): Set<string> {
  const shas = new Set<string>();
  const lines = blameOutput.split('\n');

  for (const line of lines) {
    // Porcelain format: first line of each block is the commit SHA
    // Format: <sha> <original-line> <final-line> <num-lines>
    if (line.match(/^[0-9a-f]{40} /)) {
      const sha = line.split(' ')[0];
      shas.add(sha);
    }
  }

  return shas;
}
