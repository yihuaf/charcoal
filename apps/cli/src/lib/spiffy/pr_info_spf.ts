import { z } from 'zod';
import { spiffy } from './spiffy';

// Define the PR info schema manually based on GitHub CLI output
const prInfoSchema = z.array(
  z.object({
    prNumber: z.number(),
    headRefName: z.string(),
    baseRefName: z.string(),
    title: z.string(),
    body: z.string(),
    url: z.string(),
    state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
    reviewDecision: z
      .enum(['APPROVED', 'REVIEW_REQUIRED', 'CHANGES_REQUESTED'])
      .optional(),
    isDraft: z.boolean(),
  })
);

export const prInfoConfigFactory = spiffy({
  schema: z.object({
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
