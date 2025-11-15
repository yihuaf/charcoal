import { SpawnSyncOptions } from 'child_process';
import { runGitCommand } from './runner';

import { rebaseInProgress } from './rebase_in_progress';

type TRebaseResult = 'REBASE_CONFLICT' | 'REBASE_DONE';
export function rebase(args: {
  onto: string;
  from: string;
  branchName: string;
  restackCommitterDateIsAuthorDate?: boolean;
}): TRebaseResult {
  return rebaseInternal({
    args: [
      ...(args.restackCommitterDateIsAuthorDate
        ? [`--committer-date-is-author-date`]
        : []),
      `--onto`,
      args.onto,
      args.from,
      args.branchName,
    ],
  });
}

export function rebaseContinue(): TRebaseResult {
  return rebaseInternal({
    args: ['--continue'],
    options: {
      env: { ...process.env, GIT_EDITOR: 'true' },
    },
  });
}

export function rebaseAbort(): void {
  runGitCommand({
    args: [`rebase`, `--abort`],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}

export function rebaseInteractive(args: {
  parentBranchRevision: string;
  branchName: string;
}): TRebaseResult {
  return rebaseInternal({
    args: [`-i`, args.parentBranchRevision, args.branchName],
    options: { stdio: 'inherit' },
  });
}

function rebaseInternal(params: {
  args: string[];
  options?: Pick<SpawnSyncOptions, 'stdio' | 'env'>;
}) {
  try {
    runGitCommand({
      args: ['rebase', ...params.args],
      options: { stdio: 'pipe', ...params.options },
      onError: 'throw',
    });
  } catch (e) {
    if (rebaseInProgress()) {
      return 'REBASE_CONFLICT';
    } else {
      throw e;
    }
  }
  return 'REBASE_DONE';
}
