<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Which outlet?</div>
        <!-- The one field this screen exists to collect, so NOT dense (§10.5). -->
        <component
          :is="SelectField"
          :model-value="wizard.outletCode.value"
          :record="wizard.node.record.value"
          :config="{ label: 'Outlet', options: wizard.outletOptions.value, clearable: false }"
          header="OutletCode"
          @update:model-value="selectOutlet"
        />

        <!-- A banner, not a card: it states a fact ABOUT the field above it (§10.4). -->
        <q-banner
          v-if="wizard.outletCode.value && !wizard.plannedVisitCards.value.length"
          dense
          rounded
          class="bg-grey-2 text-body2"
        >
          No visit is planned for this outlet — this will be recorded as a walk-in consumption.
        </q-banner>
      </q-card-section>
    </q-card>

    <!-- Planned visits as SELECTABLE CARDS rather than a dropdown. Deliberately NOT
         `dense`: this is a primary touch target on a phone, and a dense row puts the tap
         area below the UI's `minTapTargetPx` floor. A collapsed select also hid both how
         many visits are due and how late they are, which is what the officer chooses on. -->
    <template v-if="wizard.plannedVisitCards.value.length">
      <SectionDividerLabel label="PLANNED VISIT" />
      <!-- EXACTLY ONE click handler in the card, on the `q-item`.
           It previously sat on both the `q-card` and the `q-item` inside it, so a single
           tap bubbled through both and `toggleVisit` ran twice — selecting and then
           immediately deselecting, which read as the card refusing to be picked. The card
           keeps the selected tint; the item owns the interaction. -->
      <q-card
        v-for="visit in wizard.plannedVisitCards.value"
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

    <!-- Direct restock is offered ONLY where it can actually be honoured: the user's
         access region must contain a warehouse to draw from. An unavailable mode is not
         shown disabled, it is not shown (§13.0). -->
    <q-card v-if="wizard.regionWarehouses.value.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">Direct restock</div>
            <div class="text-caption text-grey-8">
              Carry replacement stock from your region's warehouse on this visit, instead
              of raising a request for someone to approve.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle :model-value="wizard.directRestock.value" color="primary" @update:model-value="setDirect" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="wizard.directRestock.value" class="q-pt-none">
        <component
          :is="SelectField"
          v-if="wizard.regionWarehouses.value.length > 1"
          :model-value="wizard.warehouseCode.value"
          :record="{}"
          :config="{ label: 'Source warehouse', options: wizard.regionWarehouses.value, clearable: false }"
          header="WarehouseCode"
          @update:model-value="(value) => wizard.set(FIELDS.WAREHOUSE, value)"
        />
        <div v-else class="text-body2 text-grey-8">
          Drawing from <span class="text-weight-medium">{{ wizard.regionWarehouses.value[0].label }}</span>.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 1 — context and restock source.
 *
 * Two differently-scoped questions, so two cards (§7.5): which outlet and visit this audit
 * belongs to, and where any replenishment will come from. The second is a MODE chosen
 * before any data is entered, produces the same record shape, and differs only in the
 * states the submit handler writes — which is exactly the test for building a branch
 * inside Add rather than as its own action route (§13.0).
 *
 * `Username` and `Date` are never rendered. They are system facts — the signed-in user and
 * today — seeded onto the node below and left out of the form entirely, so an audit cannot
 * be attributed to someone else or back-dated.
 *
 * PRE-SELECTION. Arriving with `?outletCode=` selects that outlet; arriving with
 * `?visitCode=` as well selects the visit too. With only an outlet, today's planned visit
 * is selected automatically if there is one — the Index page's scheduled queue links here
 * precisely so the officer never types either.
 *
 * Navigation belongs to the sticky bar (`Add/PageAction.js`), which reads these values back
 * off `pageState` to gate `next`. No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddContext', inheritAttrs: false })

const props = defineProps({
  // Assigned by the contract, never hardcoded here — the same card could serve a
  // single-view page, where `step: null` means "always render" (§13.6).
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState, user, query } = wizard

// Resolved, never deep-imported: `resolveFieldComponent` follows a type's aliases and
// prepared-props branches, and a direct `_fields/select/Add.vue` import would not (§2.4).
const SelectField = resolveFieldComponent('select', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

function selectOutlet (value) {
  pageState.setField('OutletConsumptions', 'OutletCode', value || '')
  // A different outlet invalidates the whole count, so the visit is cleared with it rather
  // than silently attaching this audit to another outlet's plan.
  pageState.setField('OutletConsumptions', 'OutletVisitCode', '')
  wizard.seedCountRows(true)
  autoSelectTodaysVisit()
}

function selectVisit (value) {
  pageState.setField('OutletConsumptions', 'OutletVisitCode', value || '')
}

/**
 * Which card is currently chosen.
 *
 * Compared as TRIMMED STRINGS rather than by identity: `OutletVisitCode` round-trips
 * through `pageState`, which may hand back a value with different whitespace from the one
 * the card carries, and a `===` on the raw values then reports every card as unselected.
 */
const isSelected = (visit) =>
  String(visit.code || '').trim() === String(wizard.visitCode.value || '').trim()

/** Tapping the selected card clears it — the visit link is optional, so it must be undoable. */
function toggleVisit (code) {
  const next = String(code || '').trim()
  selectVisit(String(wizard.visitCode.value || '').trim() === next ? '' : next)
}

/** With an outlet chosen and a visit planned for today, that is the visit — offering it as
 *  an empty dropdown asks a question whose answer is already known. */
function autoSelectTodaysVisit () {
  if (wizard.visitCode.value) return
  const today = new Date().toISOString().slice(0, 10)
  const match = wizard.visitOptions.value.find((option) => option.label.startsWith(today))
  if (match) selectVisit(match.value)
}

function setDirect (value) {
  const direct = value === true && wizard.regionWarehouses.value.length > 0
  wizard.set(FIELDS.DIRECT_RESTOCK, direct)
  // Turning it off clears the warehouse so a stale code cannot ride along on a request
  // that is no longer direct.
  wizard.set(FIELDS.WAREHOUSE, direct
    ? (wizard.warehouseCode.value || wizard.regionWarehouses.value[0].value)
    : '')
  if (!direct) wizard.set(FIELDS.MARK_DELIVERED, false)
}

onMounted(async () => {
  pageState.initResource('OutletConsumptions', {
    reset: true,
    isPrimaryKey: true,
    fields: {
      Date: new Date().toISOString().slice(0, 10),
      Username: user.value?.name || user.value?.email || '',
      Progress: wizard.PENDING_INVOICE_GENERATION,
      Status: 'Active'
    }
  })

  // Every resource the LATER steps need is loaded HERE, at step 1, so step 2 does not
  // issue a fetch per card as the user arrives (§13.5). `reload()` renders from whatever
  // the store already holds and syncs the delta in the background, so a warm cache shows
  // the form immediately.
  await Promise.all(Object.values(wizard.resources).map((resource) => resource.reload()))

  const queryOutlet = String(query.value.outletCode || '').trim()
  if (queryOutlet && wizard.outletOptions.value.some((option) => option.value === queryOutlet)) {
    selectOutlet(queryOutlet)
    const queryVisit = String(query.value.visitCode || '').trim()
    if (queryVisit && wizard.visitOptions.value.some((option) => option.value === queryVisit)) selectVisit(queryVisit)
  }
})
</script>
