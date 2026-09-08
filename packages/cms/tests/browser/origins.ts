const host = process.env.CMS_TRIAL_HOST ?? '127.0.0.1'
const protocol = process.env.CMS_TRIAL_HOST ? 'https' : 'http'
export const cmsOrigin = `${protocol}://${host}:4010`
export const previewOrigin = `${protocol}://${host}:4324`
