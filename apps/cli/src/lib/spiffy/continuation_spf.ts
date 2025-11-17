import { z } from 'zod';
import { spiffy } from './spiffy';

/**
 * After Graphite is interrupted by a merge conflict, upon continuing, there
 * are 3 main things we need to do, in the following order.
 *
 * 1) Complete the original rebase operation.
 * 2) Sync any remaining branches from remote.
 * 3) Restack any remaining branches that were queued.
 *
 * The below object persists the queue of branches to be restacked.
 * We also store the Graphite current branch, so that we can switch back to it.
 * We need to keep track of the new parentBranchRevision for the branch that
 * hit a merge conflict, as we cannot pull this information from Git.
 */
const ContinueSchema = z.object({
  branchesToSync: z.array(z.string()),
  branchesToRestack: z.array(z.string()),
  currentBranchOverride: z.string().optional(),
  rebasedBranchBase: z.string().optional(),
});

export const continueConfigFactory = spiffy({
  schema: ContinueSchema,
  defaultLocations: [
    {
      relativePath: '.gtcontinue',
      relativeTo: 'REPO',
    },
  ],
  initialize: () => {
    return {};
  },
  helperFunctions: () => {
    return {} as const;
  },
  options: { removeIfEmpty: true, removeIfInvalid: true },
});

export type TContinueConfig = ReturnType<typeof continueConfigFactory.load>;
