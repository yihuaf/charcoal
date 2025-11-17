import { z } from 'zod';
import { spiffy } from './spiffy';

const schema = z.object({
  timestamp: z.number().optional(),
  pid: z.number().optional(),
});

export const cacheLockConfigFactory = spiffy({
  schema,
  defaultLocations: [
    {
      relativePath: '.graphite_cache_lock',
      relativeTo: 'REPO',
    },
  ],
  initialize: () => {
    return {
      timestamp: undefined,
      pid: undefined,
    };
  },
  helperFunctions: () => {
    return {};
  },
  options: { removeIfEmpty: true },
});
