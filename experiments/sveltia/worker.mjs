import materials from './talk-materials.json' with { type: 'json' }
import { createMaterialsWorker } from './materials-worker.mjs'

export default createMaterialsWorker(materials)
