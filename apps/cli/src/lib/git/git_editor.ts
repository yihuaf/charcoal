import { runGitCommand } from './runner';

export function getGitEditor(): string | undefined {
  const editor = runGitCommand({
    args: [`config`, `--global`, `core.editor`],
    onError: 'ignore',
  });
  return editor.length > 0 ? editor : undefined;
}

export function getGitPager(): string | undefined {
  const editor = runGitCommand({
    args: [`config`, `--global`, `core.pager`],
    onError: 'ignore',
  });
  return editor.length > 0 ? editor : undefined;
}
