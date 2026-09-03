import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { parseAnyDate } from 'src/utils/dateHelpers'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useLeadIndex } from 'src/_resource/Master/Leads/composables/useLeadIndex'
import { useLeadProgress } from 'src/_resource/Master/Leads/composables/useLeadProgress'

// The one inject() caller behind the Leads Index page. Every widget .vue under this
// page reads its aggregate from here instead of importing src/_resource/ itself.
function hoursAgoLabel (value) {
  const at = parseAnyDate(value)
  if (!at) return ''
  const hours = Math.floor((Date.now() - at.getTime()) / 3600000)
  if (hours < 1) return 'just now'
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
}

export function useLeadIndexContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)

  return {
    resourceRecord,
    resourceConfig,
    ui: useAQLConfig(),
    index: useLeadIndex(),
    progress: useLeadProgress(),
    hoursAgoLabel,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
