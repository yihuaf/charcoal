/**
 * Type definitions for Pull Request information.
 * Previously extracted from @withgraphite/graphite-cli-routes,
 * now defined manually based on GitHub CLI output format.
 */

export type PRInfo = {
  prNumber: number;
  headRefName: string;
  baseRefName: string;
  title: string;
  body: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  reviewDecision?: 'APPROVED' | 'REVIEW_REQUIRED' | 'CHANGES_REQUESTED';
  isDraft: boolean;
};

export type TPRInfoToUpsert = PRInfo[];

export type PRSubmissionInfo = {
  head: string;
  base: string;
  title?: string;
  body?: string;
  draft?: boolean;
  action: 'create' | 'update';
  headSha: string;
  baseSha: string;
  prNumber?: number;
  reviewers?: string[];
}[];

export type SubmittedPRResponse = {
  head: string;
  status: 'created' | 'updated' | 'error';
  prNumber?: number;
  prURL?: string;
  error?: string;
};
