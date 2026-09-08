interface OperationFailure {
  reason: unknown
}

export async function runWithConcurrency<T>(
  values: readonly T[],
  maximumConcurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let failure: OperationFailure | undefined
  const pendingValues = values.values()
  const workerCount = Math.min(Math.max(1, maximumConcurrency), values.length)

  async function runWorker(): Promise<void> {
    while (!failure) {
      const nextValue = pendingValues.next()
      if (nextValue.done) return

      try {
        await operation(nextValue.value)
      } catch (reason) {
        failure ??= { reason }
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker))
  if (failure) throw failure.reason
}
