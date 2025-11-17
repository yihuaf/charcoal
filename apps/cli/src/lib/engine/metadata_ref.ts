import { z } from 'zod';
import { cuteString } from '../utils/cute_string';
import { runGitCommand, runGitCommandAndSplitLines } from '../git/runner';

export const prInfoSchema = z.object({
  number: z.number().optional(),
  base: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']).optional(),
  reviewDecision: z
    .enum(['APPROVED', 'REVIEW_REQUIRED', 'CHANGES_REQUESTED'])
    .optional(),
  isDraft: z.boolean().optional(),
});
export type TBranchPRInfo = z.infer<typeof prInfoSchema>;

const metaSchema = z.object({
  parentBranchName: z.string().optional(),
  parentBranchRevision: z.string().optional(),
  prInfo: prInfoSchema.optional(),
});
export type TMeta = z.infer<typeof metaSchema>;

export function writeMetadataRef(
  branchName: string,
  meta: TMeta,
  cwd?: string
): void {
  const metaSha = runGitCommand({
    args: [`hash-object`, `-w`, `--stdin`],
    options: {
      input: cuteString(meta),
      cwd,
    },
    onError: 'throw',
  });
  runGitCommand({
    args: [`update-ref`, `refs/branch-metadata/${branchName}`, metaSha],
    options: {
      stdio: 'pipe',
      cwd,
    },
    onError: 'throw',
  });
}

export function readMetadataRef(branchName: string, cwd?: string): TMeta {
  try {
    const meta = JSON.parse(
      runGitCommand({
        args: [`cat-file`, `-p`, `refs/branch-metadata/${branchName}`],
        options: {
          cwd,
        },
        onError: 'ignore',
      })
    );

    const result = metaSchema.safeParse(meta);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function deleteMetadataRef(branchName: string): void {
  runGitCommand({
    args: [`update-ref`, `-d`, `refs/branch-metadata/${branchName}`],
    onError: 'throw',
  });
}

export function getMetadataRefList(): Record<string, string> {
  const meta: Record<string, string> = {};
  runGitCommandAndSplitLines({
    args: [
      `for-each-ref`,
      `--format=%(refname:lstrip=2):%(objectname)`,
      `refs/branch-metadata/`,
    ],
    onError: 'throw',
  })
    .map((line) => line.split(':'))
    .filter(
      (lineSplit): lineSplit is [string, string] =>
        lineSplit.length === 2 && lineSplit.every((s) => s.length > 0)
    )
    .forEach(([branchName, metaSha]) => (meta[branchName] = metaSha));

  return meta;
}
