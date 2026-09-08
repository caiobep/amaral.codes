import config from '@payload-config'
import { generatePageMetadata, RootPage } from '@payloadcms/next/views'
import { importMap } from '../importMap'

interface Props {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<Record<string, string | string[]>>
}

export const generateMetadata = ({ params, searchParams }: Props) => generatePageMetadata({ config, params, searchParams })

export default function Page({ params, searchParams }: Props) {
  return RootPage({ config, params, searchParams, importMap })
}
