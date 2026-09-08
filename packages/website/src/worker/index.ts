import {
  handleAgentMarkdownRequest,
  type AssetFetcher,
} from '../edge/agent-markdown'

interface Environment {
  ASSETS: AssetFetcher
}

export default {
  fetch(request: Request, environment: Environment) {
    return handleAgentMarkdownRequest(request, environment)
  },
}
