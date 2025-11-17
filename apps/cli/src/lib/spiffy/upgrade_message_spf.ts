import { z } from 'zod';
import { spiffy } from './spiffy';

const schema = z.object({
  message: z
    .object({
      contents: z.string(),
      cliVersion: z.string(),
    })
    .optional(),
});

export const messageConfigFactory = spiffy({
  schema,
  defaultLocations: [
    {
      relativePath: '.graphite_upgrade_message',
      relativeTo: 'USER_HOME',
    },
  ],
  initialize: () => {
    return {
      message: undefined,
    };
  },
  helperFunctions: () => {
    return {};
  },
  options: { removeIfEmpty: true },
});

export type TMessageConfig = ReturnType<typeof messageConfigFactory.load>;
