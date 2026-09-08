import type { ContentRecord } from './types'

export function byId<T extends ContentRecord<unknown>>(left: T, right: T) {
  return left.id.localeCompare(right.id)
}

export function orderByUniqueRank<T extends ContentRecord<unknown>>(
  records: readonly T[],
  getRank: (record: T) => number,
  label: string,
) {
  const idsByRank = new Map<number, string>()

  records.forEach((record) => {
    const rank = getRank(record)
    const existingId = idsByRank.get(rank)

    if (existingId) {
      throw new Error(`Duplicate ${label} ${String(rank)}: "${existingId}" and "${record.id}".`)
    }

    idsByRank.set(rank, record.id)
  })

  return [...records].sort((left, right) => getRank(left) - getRank(right) || byId(left, right))
}
