/**
 * AQL UI — config relay composable.
 *
 * The one file under _ui/AQL/composables/ that imports _config/config.js directly.
 * UI components and page context composables import this relay.
 *
 * Canonical spec:
 *   Documents/UI_MODULE_DEVELOPER_GUIDE.md §10.1
 */
import config from 'src/_ui/AQL/_config/config'

export function useAQLConfig () {
  return config
}

export default useAQLConfig
