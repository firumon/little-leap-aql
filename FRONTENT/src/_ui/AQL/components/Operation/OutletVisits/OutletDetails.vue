<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="45%" class="q-mb-sm" />
        <q-skeleton type="text" width="70%" />
      </q-card-section>

      <template v-else-if="outlet">
        <q-list>
          <q-item>
            <q-item-section side top><q-icon :name="finalIcon" :color="finalColor" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-subtitle2 text-weight-bold">{{ outletName }}</q-item-label>
              <q-item-label caption>{{ outletCode }}</q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-btn flat round dense size="sm" :color="finalColor" icon="open_in_new" :aria-label="finalLinkLabel" @click="openOutlet"/>
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator v-if="visibleLines.length" />

        <q-card-section v-if="visibleLines.length">
          <div class="aql-detail-grid">
            <div
              v-for="(line, index) in visibleLines"
              :key="line.label"
              class="aql-detail-line items-center aql-detail-row"
              :style="rowDelay(index)"
            >
              <span class="aql-detail-key">{{ line.label }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                <!-- A phone number is the one value here worth acting on directly, so
                     it renders as a tel: link rather than static text. -->
                <a v-if="line.tel" class="aql-visit-link" :href="`tel:${line.value}`">{{ line.value }}</a>
                <span v-else>{{ line.value }}</span>
              </span>
            </div>
          </div>
        </q-card-section>
      </template>

      <q-card-section v-else class="text-caption text-grey-7">
        This visit has no linked outlet record.
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletVisits › OutletDetails — Section (tier 3: resource-level Vue override).
 *
 * There is no `components/sections/OutletDetails.vue`, so useSectionResolver promotes
 * this file to serve as the base section as well as the override (§1.4 step 1c).
 *
 * Layout mirrors `contents/ViewRecord.vue` exactly — `SectionDividerLabel` heading,
 * `page-card aql-premium-gradient-card` shell, and the `.aql-detail-grid` /
 * `.aql-detail-line` / `.aql-detail-key` / `.aql-detail-val` row grammar with the same
 * 40ms stagger — so this card is indistinguishable from a framework detail card.
 *
 * The outlet is read through the visit's `$outlet` relation getter, which the View
 * page's `loadRelations()` has already fetched. The record reference is never spread —
 * the relation getters are non-enumerable and a copy would drop them
 * (UI_PAGE_AND_SECTION_SYSTEM.md §1.3.3).
 */
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'OutletVisitsOutletDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Outlet' },
  icon: { type: [String, Function], default: 'storefront' },
  color: { type: [String, Function], default: 'primary' },
  linkLabel: { type: [String, Function], default: 'Open outlet' },
  // Where the link goes. Overridable so a tenant can point at a hub sub-route
  // (`operation-hub`) instead of the outlet's own View page.
  outletScope: { type: [String, Function], default: 'master' },
  outletSlug: { type: [String, Function], default: 'outlets' },
  // `(outlet, visit) => [{ label, value, tel? }]`. Replaces the default line set
  // wholesale; blank values are dropped either way.
  lines: { type: [Array, Function], default: null },
  padding: { type: [String], default: 'sm' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const nav = useResourceNav()

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const spacingClass = computed(() => `q-px-${props.padding}`)

const finalTitle = computed(() => evalProp(props.title))
const finalIcon = computed(() => evalProp(props.icon))
const finalColor = computed(() => evalProp(props.color))
const finalLinkLabel = computed(() => evalProp(props.linkLabel))

const visit = computed(() => resourceRecord?.record?.value || null)
const outlet = computed(() => visit.value?.$outlet || null)

// Sections render OUTSIDE AqlContentWrapper, so they see no loading gate of their own.
// Skeleton only while there is genuinely nothing to draw — a background sync keeps the
// populated card on screen.
const pending = computed(() => !visit.value && resourceRecord?.loading?.value === true)

const outletName = computed(() => outlet.value?.Name || visit.value?.OutletCode || '—')
const outletCode = computed(() => outlet.value?.Code || visit.value?.OutletCode || '')

// Region reads Province → Area → AccessRegion: the Outlets sheet carries all three and
// which one a tenant actually populates varies. First non-blank wins.
const regionValue = computed(() => {
  const row = outlet.value
  if (!row) return ''
  return row.Province || row.Area || row.AccessRegion || ''
})

const defaultLines = computed(() => {
  const row = outlet.value
  if (!row) return []
  return [
    { label: 'Contact Person', value: row.ContactPerson || '' },
    { label: 'Phone', value: row.Phone || '', tel: true },
    { label: 'City', value: row.City || '' },
    { label: 'Region', value: regionValue.value }
  ]
})

const visibleLines = computed(() => {
  const supplied = typeof props.lines === 'function'
    ? props.lines(outlet.value, visit.value)
    : props.lines
  const source = Array.isArray(supplied) ? supplied : defaultLines.value
  return source.filter((line) => line && String(line.value ?? '').trim())
})

// Same 40ms cadence ViewRecord.vue uses, so stacked cards animate in step.
function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}

function openOutlet () {
  const code = outletCode.value
  if (!code) return
  nav.goTo('view', {
    scope: evalProp(props.outletScope),
    resourceSlug: evalProp(props.outletSlug),
    code
  })
}
</script>
