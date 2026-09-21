<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Which outlet?</div>
        <component
          :is="SelectField"
          :model-value="outletCode"
          @update:model-value="selectOutlet"
          :record="record"
          :config="{ label: 'Outlet', options: outletOptions, clearable: false }"
          header="OutletCode"
        />

        <!-- One tap for the outlets the round is actually on. A shortcut, never the only
             way in. -->
        <template v-if="suggestedOutlets.length">
          <div class="text-caption text-grey-7">Scheduled today or overdue</div>
          <div class="row q-gutter-xs">
            <q-chip
              v-for="suggestion in suggestedOutlets"
              :key="suggestion.code"
              clickable
              :outline="suggestion.code !== outletCode"
              :color="suggestion.isOverdue ? 'orange' : 'primary'"
              :text-color="suggestion.code === outletCode ? 'white' : undefined"
              :icon="suggestion.isOverdue ? 'event_busy' : 'event_available'"
              :label="suggestion.label"
              @click="pickSuggestion(suggestion)"
            />
          </div>
        </template>

        <q-banner
          v-if="outletCode && !plannedVisitCards.length"
          dense
          rounded
          class="bg-grey-2 text-body2"
        >
          No visit is planned for this outlet — this will be recorded as a walk-in consumption.
        </q-banner>
      </q-card-section>
    </q-card>

    <!-- Cards, not a dropdown: on a phone this is a primary tap target, and a collapsed
         select hides how many visits are due and how late they are. -->
    <template v-if="plannedVisitCards.length">
      <SectionDividerLabel label="PLANNED VISIT" />
      <!-- One click handler only. On both the card and the item, a single tap bubbled
           through both and ran `toggleVisit` twice. -->
      <q-card
        v-for="visit in plannedVisitCards"
        :key="visit.code"
        flat
        bordered
        :class="[ui.cardClass, isSelected(visit) ? 'bg-blue-1' : '']"
      >
        <q-item clickable v-ripple :active="isSelected(visit)" @click="toggleVisit(visit.code)">
          <q-item-section avatar>
            <q-avatar :color="visit.isOverdue ? 'orange' : 'primary'" text-color="white" icon="event_available" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ formatDate(visit.date) }}</q-item-label>
            <q-item-label caption>
              <template v-if="visit.isToday">Planned for today</template>
              <template v-else-if="visit.isOverdue">Overdue</template>
              <template v-else>Upcoming</template>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon
              :name="isSelected(visit) ? 'check_circle' : 'radio_button_unchecked'"
              :color="isSelected(visit) ? 'primary' : 'grey-5'"
              size="28px"
            />
          </q-item-section>
        </q-item>
      </q-card>
      <div class="text-caption text-grey-7 q-px-sm">
        Optional — tap again to clear and record this as a walk-in consumption.
      </div>
    </template>

  </div>
</template>

<script setup>
// Step 1 - which outlet, and which planned visit.
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useVisitResource } from 'src/_resource/Operation/OutletVisits/composables/useVisitResource'
import { isPlanned } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'
import { NODE, WIZARD_RESOURCES, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddContext', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const SUGGESTED_OUTLET_LIMIT = 8

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, query, resource } = useConsumptionAddContext()
const { visitsOf } = useVisitResource()
const { outletOptions } = useOutletResource()

const text = (value) => (value == null ? '' : String(value).trim())
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'
const todayISO = () => new Date().toISOString().slice(0, 10)

const resources = WIZARD_RESOURCES.map((name) => resource(name))
const outlets = resources[WIZARD_RESOURCES.indexOf('Outlets')]
const visits = resources[WIZARD_RESOURCES.indexOf('OutletVisits')]

const record = pageState.useRecord(null, NODE.CONSUMPTION)
const outletCode = pageState.useRecord('OutletCode', NODE.CONSUMPTION)
const visitCode = pageState.useRecord('OutletVisitCode', NODE.CONSUMPTION)

const SelectField = resolveFieldComponent('select', 'add')

const visible = computed(() => stepVisible(pageState, props.step))

const activeOutlets = computed(() => outlets.items.value.filter(isActive))

const plannedVisits = computed(() => visits.items.value
  .filter((row) => isActive(row) && isPlanned(row))
  .sort((a, b) => (text(a.Date) < text(b.Date) ? -1 : 1)))

const plannedVisitCards = computed(() => {
  const today = todayISO()
  return plannedVisits.value
    .filter((row) => text(row.OutletCode) === text(outletCode.value))
    .map((row) => {
      const date = text(row.Date)
      return { code: text(row.Code), date, isToday: date === today, isOverdue: !!date && date < today }
    })
})

const suggestedOutlets = computed(() => {
  const today = todayISO()
  const byCode = new Map(activeOutlets.value.map((row) => [text(row.Code), row]))
  const seen = new Set()

  return plannedVisits.value.reduce((list, row) => {
    const code = text(row.OutletCode)
    const outlet = byCode.get(code)
    if (!code || !outlet || seen.has(code)) return list
    seen.add(code)
    const date = text(row.Date)
    list.push({
      code,
      label: text(outlet.Name) || code,
      isToday: date === today,
      isOverdue: !!date && date < today
    })
    return list
  }, []).slice(0, SUGGESTED_OUTLET_LIMIT)
})

const earliestPlannedVisit = (outlet) => text(visitsOf(outlet).find(isPlanned)?.Code)

function selectOutlet (value) {
  const outlet = text(value)
  pageState.setRecord('OutletCode', outlet, NODE.CONSUMPTION)
  pageState.setRecord('OutletVisitCode', earliestPlannedVisit(outlet), NODE.CONSUMPTION)
}

const isSelected = (visit) => text(visit.code) === text(visitCode.value)

function toggleVisit (code) {
  const next = text(code)
  pageState.setRecord('OutletVisitCode', text(visitCode.value) === next ? '' : next, NODE.CONSUMPTION)
}

function pickSuggestion (suggestion) {
  selectOutlet(suggestion.code)
}

onMounted(async () => {
  await Promise.all(resources.map((resource) => resource.reload()))

  const queryOutlet = text(query.value.outletCode)
  if (!queryOutlet || !outletOptions.value.some((option) => option.value === queryOutlet)) return
  selectOutlet(queryOutlet)

  const queryVisit = text(query.value.visitCode)
  if (queryVisit && plannedVisitCards.value.some((visit) => visit.code === queryVisit)) {
    pageState.setRecord('OutletVisitCode', queryVisit, NODE.CONSUMPTION)
  }
})
</script>
