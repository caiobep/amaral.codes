const PARAMETER_ALIASES = {
  category: ['type'],
  featured: [],
  label: [],
  name: ['a'],
  query: ['q'],
  shortcut: ['s'],
  url: ['l'],
} as const

export type QueryParameter = keyof typeof PARAMETER_ALIASES

export const getQueryParameter = (
  searchParams: URLSearchParams,
  parameter: QueryParameter,
) => {
  const value = searchParams.get(parameter)
  if (value !== null) return value

  const alias = PARAMETER_ALIASES[parameter].find((candidate) => searchParams.has(candidate))
  return alias ? searchParams.get(alias) : null
}

export const setQueryParameter = (
  searchParams: URLSearchParams,
  parameter: QueryParameter,
  value?: string,
) => {
  PARAMETER_ALIASES[parameter].forEach((alias) => searchParams.delete(alias))
  if (value) searchParams.set(parameter, value)
  else searchParams.delete(parameter)
}
