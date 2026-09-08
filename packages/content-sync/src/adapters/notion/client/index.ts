import { Client } from '@notionhq/client'

export type NotionClient = Client

export function createNotionClient(token: string): Client {
  return new Client({
    auth: token,
    notionVersion: '2026-03-11',
  })
}
