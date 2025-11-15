import * as t from '@withgraphite/retype';
import { spiffy } from './spiffy';

// Define the PR info schema manually based on GitHub CLI output
const prInfoSchema = t.array(
  t.shape({
    prNumber: t.number,
    headRefName: t.string,
    baseRefName: t.string,
    title: t.string,
    body: t.string,
    url: t.string,
    state: t.unionMany([
      t.literal('OPEN'),
      t.literal('CLOSED'),
      t.literal('MERGED'),
    ]),
    reviewDecision: t.optional(
      t.unionMany([
        t.literal('APPROVED'),
        t.literal('REVIEW_REQUIRED'),
        t.literal('CHANGES_REQUESTED'),
      ])
    ),
    isDraft: t.boolean,
  })
);

export const prInfoConfigFactory = spiffy({
  schema: t.shape({
    prInfoToUpsert: prInfoSchema,
  }),
  defaultLocations: [
    {
      relativePath: '.graphite_pr_info',
      relativeTo: 'REPO',
    },
  ],
  helperFunctions: () => {
    return {};
  },
  initialize: () => {
    return {
      prInfoToUpsert: [],
    };
  },
});
