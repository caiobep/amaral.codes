import { withPayload } from '@payloadcms/next/withPayload'

export default withPayload({
  agentRules: false,
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { root: new URL('../..', import.meta.url).pathname },
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    }]
  },
})
