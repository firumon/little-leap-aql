import { ref, computed, inject } from 'vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useLeadResource } from 'src/_resource/Master/Leads/composables/useLeadResource'
import {
  useFollowUpResource,
  enrichFollowUp
} from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpResource'
import { sortByDate } from 'src/utils/sortHelpers'

// LeadFollowUps > View — the one injection relay for this page's cards
// (UI_RESOURCE_DOMAIN_LOGIC §6.1). The lead join happens here, once, so the four
// sections share a single answer about which lead this follow-up belongs to.

const text = (value) => (value == null ? '' : String(value).trim())

// The Leads sheet is not this page's own resource, so it is fetched once per app run.
let pendingLoad = null
let leadsLoaded = false

export function useFollowUpViewContext () {
  const nav = useResourceNav()
  const { code } = useRouteConfig()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const { leadsByCode } = useLeadResource()
  const { followUpsOf } = useFollowUpResource()

  const loaded = ref(leadsLoaded)
  if (!leadsLoaded) {
    if (!pendingLoad) {
      const leads = useRecord('Leads')
      pendingLoad = leads.reload().finally(() => {
        leadsLoaded = true
        pendingLoad = null
      })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  const followUpCode = computed(() => text(code.value))

  // Enriched from the page's own record rather than picked out of the shared list: the
  // record the route loaded is the freshest copy of the row on screen.
  const followUp = computed(() => {
    const row = resourceRecord?.record?.value
    return row ? enrichFollowUp(row, leadsByCode.value) : null
  })

  const pending = computed(() => !followUp.value && resourceRecord?.loading?.value === true)
  const leadPending = computed(() => pending.value || !loaded.value)

  const leadCode = computed(() => followUp.value?.leadCode || '')
  const lead = computed(() => leadsByCode.value.get(leadCode.value) || null)

  const otherFollowUps = computed(() => {
    const siblings = followUpsOf(leadCode.value)
      .filter((row) => row.code !== followUpCode.value)
    return sortByDate(siblings, 'Date', 'desc')
  })

  return {
    evaluate: (value) => (typeof value === 'function'
      ? value(followUp.value, resourceConfig?.config?.value ?? null)
      : value),

    followUp,
    followUpCode,
    lead,
    leadCode,
    pending,
    leadPending,
    otherFollowUps,

    openLead: () => {
      if (!leadCode.value) return
      nav.goTo('view', { scope: 'master', resourceSlug: 'leads', code: leadCode.value })
    },
    openFollowUp: (target) => {
      const next = text(target)
      if (!next) return
      nav.goTo('view', { scope: 'operation', resourceSlug: 'lead-follow-ups', code: next })
    }
  }
}
