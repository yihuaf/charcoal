import yargs from 'yargs';
import chalk from 'chalk';
import { init } from '../actions/init';
import { refreshPRInfoInBackground } from '../background_tasks/fetch_pr_info';
import {
  initContext,
  initContextLite,
  TContext,
  TContextLite,
} from './context';
import { getCacheLock, TCacheLock } from './engine/cache_lock';
import {
  BadTrunkOperationError,
  ConcurrentExecutionError,
  DetachedError,
  ExitFailedError,
  KilledError,
  PreconditionsFailedError,
  RebaseConflictError,
  UntrackedBranchError,
} from './errors';
import { composeGit } from './git/git';
import { TGlobalArguments } from './global_arguments';
import { CommandFailedError, CommandKilledError } from './git/runner';

export async function graphite(
  args: yargs.Arguments & TGlobalArguments,
  handler: (context: TContext) => Promise<void>,
  skipAutoInit?: boolean
): Promise<void> {
  return graphiteInternal(args, {
    repo: true as const,
    run: handler,
    skipAutoInit,
  });
}

export async function graphiteWithoutRepo(
  args: yargs.Arguments & TGlobalArguments,
  handler: (context: TContextLite) => Promise<void>
): Promise<void> {
  return graphiteInternal(args, {
    repo: false as const,
    run: handler,
  });
}

async function graphiteInternal(
  args: yargs.Arguments & TGlobalArguments,
  handler: TGraphiteCommandHandler
): Promise<void> {
  const handlerMaybeWithCacheLock = handler.repo
    ? {
        ...handler,
        cacheLock: getCacheLock(),
      }
    : { ...handler, cacheLock: undefined };

  process.on('SIGINT', (): never => {
    handlerMaybeWithCacheLock.cacheLock?.release();
    // eslint-disable-next-line no-restricted-syntax
    process.exit(1);
  });
  const git = composeGit();
  const contextLite = initContextLite({
    ...args,
    userEmail: git.getUserEmail(),
  });

  try {
    if (!handlerMaybeWithCacheLock.repo) {
      await handlerMaybeWithCacheLock.run(contextLite);
      return;
    }

    const context = initContext(contextLite, git, args);
    await graphiteHelper(handlerMaybeWithCacheLock, context);
  } catch (err) {
    handleGraphiteError(err, contextLite);
    contextLite.splog.debug(err.stack);
    // print errors when debugging tests
    if (process.env.DEBUG) {
      process.stdout.write(err.stack.toString());
    }
    process.exitCode = 1;
  }
}

async function graphiteHelper(
  handler: TGraphiteCommandHandlerWithCacheLock,
  context: TContext
): Promise<{
  cacheBefore: string;
  cacheAfter: string;
}> {
  const cacheBefore = context.engine.debug;

  try {
    refreshPRInfoInBackground(context);

    if (!handler.skipAutoInit && !context.repoConfig.graphiteInitialized()) {
      context.splog.info(
        `Charcoal has not been initialized, attempting to setup now...`
      );
      context.splog.newline();
      await init({}, context);
    }

    await handler.run(context);
  } catch (err) {
    if (
      err.constructor === DetachedError &&
      context.engine.rebaseInProgress()
    ) {
      throw new DetachedError(
        `Did you mean to run ${chalk.cyan(`gt continue`)}?`
      );
    }
    throw err;
  } finally {
    try {
      context.engine.persist();
    } catch (persistError) {
      context.engine.clear();
      context.splog.debug(`Failed to persist Charcoal cache`);
    }
    handler.cacheLock.release();
  }

  return { cacheBefore, cacheAfter: context.engine.debug };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleGraphiteError(err: any, context: TContextLite): void {
  switch (err.constructor) {
    case CommandKilledError:
    case KilledError: // the user doesn't need a message if they ended gt
    case RebaseConflictError: // we've already logged a message
      // pass
      return;

    case UntrackedBranchError:
    case BadTrunkOperationError:
    case ExitFailedError:
    case ConcurrentExecutionError:
    case PreconditionsFailedError:
    case CommandFailedError:
    default:
      context.splog.error(err.message);
      return;
  }
}

// typescript is fun!
type TGraphiteCommandHandler =
  | {
      repo: true;
      run: (context: TContext) => Promise<void>;
      skipAutoInit?: boolean;
    }
  | {
      repo: false;
      run: (contextLite: TContextLite) => Promise<void>;
    };
type TGraphiteCommandHandlerWithCacheLock = {
  run: (context: TContext) => Promise<void>;
  cacheLock: TCacheLock;
  skipAutoInit?: boolean;
};
