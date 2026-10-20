import assert from 'node:assert/strict'

export function prepareTalkMaterials(metadata, materials) {
  for (const material of metadata.talk?.materials ?? []) {
    const url = new URL(material.url, 'https://amaral.codes')
    if (url.origin !== 'https://assets.amaral.codes') continue
    assert(
      /^\/talks\/[a-z0-9-]+\/slides\.(pdf|key|pptx?)$/u.test(url.pathname) &&
        !url.search && !url.hash,
      'Talk materials must reference a canonical slide file',
    )
    material.url = url.pathname
    materials.set(material.url, url.pathname.slice(1))
  }
}
