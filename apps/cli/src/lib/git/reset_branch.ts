import { runGitCommand } from './runner';

export function softReset(sha: string): void {
  runGitCommand({
    args: [`reset`, `-q`, `--soft`, sha],
    onError: 'throw',
  });
}

export function mixedReset(sha?: string): void {
  runGitCommand({
    args: [`reset`, `-q`, `--mixed`, ...(sha ? [sha] : [])],
    onError: 'throw',
  });
}

export function hardReset(sha?: string): void {
  runGitCommand({
    args: [`reset`, `-q`, `--hard`, ...(sha ? [sha] : [])],
    onError: 'throw',
  });
}

export function trackedReset(sha: string): void {
  runGitCommand({
    args: [`reset`, `-Nq`, sha],
    onError: 'throw',
  });
}
