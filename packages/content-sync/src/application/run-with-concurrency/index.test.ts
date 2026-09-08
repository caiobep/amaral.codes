import assert from 'node:assert/strict'
import { test } from 'vitest'
import { runWithConcurrency } from './index.ts'

test('runs every operation while respecting the concurrency limit', async () => {
  let activeOperations = 0
  let highestConcurrency = 0
  const completed: number[] = []

  await runWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    activeOperations += 1
    highestConcurrency = Math.max(highestConcurrency, activeOperations)
    await Promise.resolve()
    completed.push(value)
    activeOperations -= 1
  })

  assert.equal(highestConcurrency, 2)
  assert.deepEqual(completed.sort(), [1, 2, 3, 4])
})

test('waits for active operations and stops assigning work after a failure', async () => {
  const activeOperation = deferred()
  const started: string[] = []
  const failure = new Error('export failed')

  const result = runWithConcurrency(
    ['failure', 'active', 'unassigned'],
    2,
    async (value) => {
      started.push(value)
      if (value === 'failure') throw failure
      if (value === 'active') await activeOperation.promise
    },
  ).then(
    () => ({ status: 'resolved' as const }),
    (reason: unknown) => ({ reason, status: 'rejected' as const }),
  )

  await waitForTurn()
  assert.deepEqual(started, ['failure', 'active'])
  assert.equal(await isSettled(result), false)

  activeOperation.resolve()
  assert.deepEqual(await result, { reason: failure, status: 'rejected' })
  assert.deepEqual(started, ['failure', 'active'])
})

test('accepts an empty collection without starting workers', async () => {
  let operationCount = 0

  await runWithConcurrency([], 3, () => {
    operationCount += 1
    return Promise.resolve()
  })

  assert.equal(operationCount, 0)
})

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending')
  return await Promise.race([promise, Promise.resolve(pending)]) !== pending
}

function waitForTurn(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}
