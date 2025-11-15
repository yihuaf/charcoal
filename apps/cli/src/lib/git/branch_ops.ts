import { runGitCommand } from './runner';

export function getCurrentBranchName(): string | undefined {
  const branchName = runGitCommand({
    args: [`branch`, `--show-current`],
    onError: 'ignore',
  });

  return branchName.length > 0 ? branchName : undefined;
}

export function moveBranch(newName: string): void {
  runGitCommand({
    args: [`branch`, `-m`, newName],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}

export function deleteBranch(branchName: string): void {
  runGitCommand({
    args: [`branch`, `-D`, branchName],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}

export function switchBranch(
  branch: string,
  opts?: { new?: boolean; detach?: boolean; force?: boolean }
): void {
  runGitCommand({
    args: [
      `switch`,
      ...(opts?.detach ? ['-d'] : []),
      ...(opts?.force ? ['-f'] : []),
      ...(opts?.new ? ['-c'] : []),
      branch,
    ],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}

export function forceCheckoutNewBranch(branchName: string, sha: string): void {
  runGitCommand({
    args: [`switch`, `-C`, branchName, sha],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}

export function forceCreateBranch(branchName: string, sha: string): void {
  runGitCommand({
    args: [`branch`, `-f`, branchName, sha],
    options: { stdio: 'pipe' },
    onError: 'throw',
  });
}
