import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useFollowUpIndex } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpIndex'
import { useFollowUpProgress } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'

// The one inject() caller behind the LeadFollowUps Index page. Core composables are
// relayed here so a widget .vue under this page carries a single import.
export function useFollowUpIndexContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)

  return {
    resourceRecord,
    resourceConfig,
    ui: useAQLConfig(),
    index: useFollowUpIndex(),
    progress: useFollowUpProgress(),
    auth: useAuth(),
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
