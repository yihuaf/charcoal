import yargs from 'yargs';
import { absorbAction } from '../actions/absorb';
import { graphite } from '../lib/runner';

const args = {
  'dry-run': {
    describe: `Print which commits the hunks would be absorbed into, but do not actually absorb them.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'd',
  },
  force: {
    describe: `Do not prompt for confirmation; apply the hunks to the commits immediately.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'f',
  },
  all: {
    describe: `Stage all unstaged changes before absorbing. Unlike create and modify, this will not include untracked files, as file creations would never be absorbed.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'a',
  },
  patch: {
    describe: `Pick hunks to stage before absorbing.`,
    demandOption: false,
    default: false,
    type: 'boolean',
    alias: 'p',
  },
} as const;

export const command = 'absorb';
export const aliases = ['ab'];
export const description =
  'Amend staged changes to the relevant commits in the current stack. Relevance is calculated by checking the changes in each commit downstack from the current commit, and finding the first commit that each staged hunk (consecutive lines of changes) can be applied to deterministically. If there is no clear commit to absorb a hunk into, it will not be absorbed. Prompts for confirmation before amending the commits, and restacks the branches upstack of the current branch.';
export const builder = args;
type argsT = yargs.Arguments<yargs.InferredOptionTypes<typeof args>>;
export const handler = async (argv: argsT): Promise<void> => {
  return graphite(argv, async (context) =>
    absorbAction(
      {
        dryRun: argv['dry-run'],
        force: argv.force,
        all: argv.all,
        patch: argv.patch,
      },
      context
    )
  );
};
