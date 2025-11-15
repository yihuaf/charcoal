import { runAsyncGitCommand, runGitCommand } from './runner';

export function getMergeBase(left: string, right: string): string {
  return runGitCommand({
    args: [`merge-base`, left, right],
    onError: 'throw',
  });
}

export function getMergeBaseAsync(
  left: string,
  right: string
): Promise<string> {
  return runAsyncGitCommand({
    args: [`merge-base`, left, right],
    onError: 'throw',
  });
}
