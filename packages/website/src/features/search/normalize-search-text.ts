export const normalizeSearchText = (value: string) => value
  .toLocaleLowerCase('en')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
