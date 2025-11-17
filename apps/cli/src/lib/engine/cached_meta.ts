import { z } from 'zod';
import { BadTrunkOperationError, UntrackedBranchError } from '../errors';
import { prInfoSchema } from './metadata_ref';

// Base schema with common fields
const baseCachedMetaSchema = z.object({
  children: z.array(z.string()),
  branchRevision: z.string(),
  prInfo: prInfoSchema.optional(),
});

// Discriminated union schema
export const cachedMetaSchema = z.discriminatedUnion('validationResult', [
  baseCachedMetaSchema.extend({
    validationResult: z.literal('VALID'),
    parentBranchName: z.string(),
    parentBranchRevision: z.string(),
  }),
  baseCachedMetaSchema.extend({
    validationResult: z.literal('INVALID_PARENT'),
    parentBranchName: z.string(),
    parentBranchRevision: z.string().optional(),
  }),
  baseCachedMetaSchema.extend({
    validationResult: z.literal('BAD_PARENT_REVISION'),
    parentBranchName: z.string(),
  }),
  baseCachedMetaSchema.extend({
    validationResult: z.literal('BAD_PARENT_NAME'),
  }),
  baseCachedMetaSchema.extend({
    validationResult: z.literal('TRUNK'),
  }),
]);
export type TCachedMeta = z.infer<typeof cachedMetaSchema>;

type TValidCachedMeta = Extract<
  TCachedMeta,
  { validationResult: 'TRUNK' | 'VALID' }
>;
export function assertCachedMetaIsValidOrTrunk(
  branchName: string,
  meta: TCachedMeta
): asserts meta is TValidCachedMeta {
  if (meta.validationResult !== 'VALID' && meta.validationResult !== 'TRUNK') {
    throw new UntrackedBranchError(branchName);
  }
}

type TNonTrunkCachedMeta = Exclude<TCachedMeta, { validationResult: 'TRUNK' }>;
export function assertCachedMetaIsNotTrunk(
  meta: TCachedMeta
): asserts meta is TNonTrunkCachedMeta {
  if (meta.validationResult === 'TRUNK') {
    throw new BadTrunkOperationError();
  }
}

export type TValidCachedMetaExceptTrunk = Extract<
  TValidCachedMeta,
  TNonTrunkCachedMeta
>;
export function assertCachedMetaIsValidAndNotTrunk(
  branchName: string,
  meta: TCachedMeta
): asserts meta is TValidCachedMetaExceptTrunk {
  assertCachedMetaIsValidOrTrunk(branchName, meta);
  assertCachedMetaIsNotTrunk(meta);
}
