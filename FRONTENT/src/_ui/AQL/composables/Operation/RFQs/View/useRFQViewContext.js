import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

// The one inject() caller on this View page. Every card on it reads this relay.
export function useRFQViewContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    resourceRecord,
    resourceConfig,
    ui,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
