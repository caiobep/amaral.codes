export const SYNC_FAILURE_MESSAGES = {
  DUPLICATE_SLUG: 'Public content contains duplicate slugs.',
  INVALID_PUBLIC_CONTENT: 'Public content does not satisfy the publishing contract.',
  NO_PUBLIC_ROWS: 'Content source returned no public rows; refusing to erase the current snapshot.',
  NO_SOURCE_ROWS: 'Content source returned no rows; refusing to erase the current snapshot.',
  RESERVED_SLUG: 'A public slug conflicts with hand-maintained content.',
  SNAPSHOT_WRITE_FAILED: 'Could not write the generated public snapshot.',
  SOURCE_READ_FAILED: 'Could not read the configured content source.',
  UNSAFE_REDUCTION: 'Public content is below the configured publication threshold.',
} as const

export type SyncFailureCode = keyof typeof SYNC_FAILURE_MESSAGES

export class SyncFailure extends Error {
  readonly code: SyncFailureCode

  constructor(code: SyncFailureCode, cause?: unknown) {
    super(SYNC_FAILURE_MESSAGES[code], cause === undefined ? undefined : { cause })
    this.name = 'SyncFailure'
    this.code = code
  }
}

export function classifySyncFailure(
  code: SyncFailureCode,
  cause: unknown,
): SyncFailure {
  return cause instanceof SyncFailure ? cause : new SyncFailure(code, cause)
}

export async function withSyncFailure<T>(
  code: SyncFailureCode,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    throw classifySyncFailure(code, cause)
  }
}
