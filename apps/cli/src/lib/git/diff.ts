import { runGitCommand } from './runner';

export function detectStagedChanges(): boolean {
  return (
    runGitCommand({
      args: [`--no-pager`, `diff`, `--no-ext-diff`, `--shortstat`, `--cached`],
      onError: 'throw',
    }).length > 0
  );
}

export function getUnstagedChanges(): string {
  return runGitCommand({
    args: [
      `-c`,
      `color.ui=always`,
      `--no-pager`,
      `diff`,
      `--no-ext-diff`,
      `--stat`,
    ],
    onError: 'throw',
  });
}

export function showDiff(left: string, right: string): string {
  return runGitCommand({
    args: [
      `-c`,
      `color.ui=always`,
      `--no-pager`,
      `diff`,
      `--no-ext-diff`,
      left,
      right,
      `--`,
    ],
    onError: 'throw',
  });
}

export function isDiffEmpty(left: string, right: string): boolean {
  return (
    runGitCommand({
      args: [
        `--no-pager`,
        `diff`,
        `--no-ext-diff`,
        `--shortstat`,
        left,
        right,
        `--`,
      ],
      onError: 'throw',
    }).length === 0
  );
}

export function getDiff(left: string, right: string | undefined): string {
  return runGitCommand({
    args: ['diff', left, ...(right ? [right] : []), '--no-prefix', '--unified'],
    onError: 'throw',
  });
}
