import { ref, computed, inject } from 'vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useLeadResource } from 'src/_resource/Master/Leads/composables/useLeadResource'
import { useFollowUpResource } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpResource'
import { sortByDate } from 'src/utils/sortHelpers'

// Leads > View — the one injection relay for this page's cards (UI_RESOURCE_DOMAIN_LOGIC
// §6.1). Every section under components/Master/Leads/ reads the lead and its follow-ups
// from here, so the three cards can never disagree about the same lead.

const text = (value) => (value == null ? '' : String(value).trim())

// The follow-up sheet is not this page's own resource, so it is fetched once per app run.
let pendingLoad = null
let followUpsLoaded = false

export function useLeadViewContext () {
  const nav = useResourceNav()
  const { code } = useRouteConfig()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const { leadOf } = useLeadResource()
  const { followUpsOf, nextFollowUpOf } = useFollowUpResource()

  const loaded = ref(followUpsLoaded)
  if (!followUpsLoaded) {
    if (!pendingLoad) {
      const followUps = useRecord('LeadFollowUps')
      pendingLoad = followUps.reload().finally(() => {
        followUpsLoaded = true
        pendingLoad = null
      })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  const leadCode = computed(() => text(code.value))

  // The enriched entry first: it carries the joined contact, place and progress keys the
  // raw sheet row does not. The raw record covers the tick before the master map settles.
  const lead = computed(() => leadOf(leadCode.value) || resourceRecord?.record?.value || null)

  const pending = computed(() => !lead.value && resourceRecord?.loading?.value === true)
  const followUpsPending = computed(() => pending.value || !loaded.value)

  const followUps = computed(() => followUpsOf(leadCode.value))
  const upcoming = computed(() => nextFollowUpOf(leadCode.value))
  const responded = computed(() =>
    sortByDate(followUps.value.filter((row) => row.isResponded), 'Date', 'desc'))

  return {
    evaluate: (value) => (typeof value === 'function'
      ? value(lead.value, resourceConfig?.config?.value ?? null)
      : value),

    lead,
    leadCode,
    pending,
    followUpsPending,
    followUps,
    upcoming,
    responded,

    openFollowUp: (followUpCode) => {
      const target = text(followUpCode)
      if (!target) return
      nav.goTo('view', { scope: 'operation', resourceSlug: 'lead-follow-ups', code: target })
    }
  }
}
