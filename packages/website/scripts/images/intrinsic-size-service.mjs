import sharpService from 'astro/assets/services/sharp'

export default {
  ...sharpService,
  async getHTMLAttributes(options, config) {
    const attributes = await sharpService.getHTMLAttributes(options, config)
    return {
      ...attributes,
      'data-intrinsic-size': '',
      style: `${attributes.style ?? ''}; --image-width: ${attributes.width}; --image-ratio: ${attributes.width / attributes.height}`,
    }
  },
}
