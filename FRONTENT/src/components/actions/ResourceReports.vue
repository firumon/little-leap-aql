<template>
  <template v-if="visible">
    <!-- 1. FAB mode (default) — floating, page-level. Bottom-left by default so it
         never collides with ResourceActions' bottom-right cluster. -->
    <q-page-sticky v-if="resolvedMode === 'fab'" :position="resolvedPosition" :offset="resolvedOffset">
      <div class="aql-report-action-container">
        <!-- Horizontal pill: icon + short label, unlike the round CRUD FAB. Quasar
             geometry is Quasar's own — QFab renders as a rounded rectangle as soon
             as `label` is set, so no CSS radius override is needed. -->
        <q-fab
          glossy
          push
          :color="resolvedColor"
          :text-color="resolvedTextColor"
          :icon="resolvedIcon"
          :active-icon="resolvedActiveIcon"
          :label="resolvedLabel"
          label-position="right"
          direction="up"
          vertical-actions-align="left"
          class="aql-report-action-fab"
          :disable="isGenerating"
        >
          <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
            {{ resolvedTooltip }}
          </q-tooltip>
          <q-fab-action
            v-for="report in displayedReports"
            :key="report.name"
            glossy
            push
            :color="resolvedItemColor"
            :text-color="resolvedTextColor"
            :icon="report.icon || resolvedIcon"
            :label="reportLabel(report)"
            label-position="right"
            external-label
            label-class="aql-report-action-label"
            class="aql-report-action-item"
            @click="initiateReport(report, activeRecord)"
          />
        </q-fab>
      </div>
    </q-page-sticky>

    <!-- 2. Toolbar mode — a single dropdown button for a header/toolbar slot. -->
    <!-- The trigger inherits the toolbar's own ink rather than taking `color`:
         a small gold-on-white glyph would not clear the 3:1 UI contrast floor. -->
    <q-btn
      v-else-if="resolvedMode === 'toolbar'"
      flat
      round
      dense
      :icon="resolvedIcon"
      :disable="isGenerating"
    >
      <q-tooltip>{{ resolvedTooltip }}</q-tooltip>
      <q-menu auto-close>
        <q-list style="min-width: 180px" separator>
          <q-item
            v-for="report in displayedReports"
            :key="report.name"
            clickable
            v-ripple
            @click="initiateReport(report, activeRecord)"
          >
            <q-item-section side>
              <q-icon :name="report.icon || resolvedIcon" :color="resolvedColor" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ reportLabel(report) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- 3. Card mode — a bordered bar of buttons, for embedding in a page body. -->
    <q-card v-else-if="resolvedMode === 'card'" flat bordered class="aql-report-action-card q-mt-sm">
      <q-card-section class="aql-report-action-card-inner q-pa-sm">
        <div class="row items-center q-gutter-xs">
          <q-btn
            v-for="report in displayedReports"
            :key="report.name"
            push
            glossy
            no-caps
            :icon="report.icon || resolvedIcon"
            :label="reportLabel(report)"
            :color="resolvedColor"
            :text-color="resolvedTextColor"
            class="aql-form-action-btn aql-report-action-btn"
            :disable="isGenerating"
            @click="initiateReport(report, activeRecord)"
          >
            <q-tooltip>{{ reportLabel(report) }}</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- 4. Inline mode — bare buttons, e.g. one entry of the FormActions bar. -->
    <template v-else>
      <q-btn
        v-for="report in displayedReports"
        :key="report.name"
        push
        glossy
        no-caps
        :icon="report.icon || resolvedIcon"
        :label="reportLabel(report)"
        :color="resolvedColor"
        :text-color="resolvedTextColor"
        class="aql-form-action-btn aql-report-action-btn"
        :disable="isGenerating"
        @click="initiateReport(report, activeRecord)"
      >
        <q-tooltip>{{ reportLabel(report) }}</q-tooltip>
      </q-btn>
    </template>

    <ReportInputDialog
      v-model="showReportDialog"
      :report="activeReport"
      :form-values="reportInputs"
      :is-generating="isGenerating"
      @update:form-values="reportInputs = $event"
      @confirm="confirmReportDialog"
      @cancel="cancelReportDialog"
    />
  </template>
</template>

<script setup>
/**
 * Report downloads as a first-class page action.
 *
 * Lives in the Action subsystem (`components/actions/`), so it is resolvable as
 * `<Action action="ResourceReports" />` and overridable at any of the 10 `_ui/`
 * tiers as `resourcereports.(vue|js)`. `PageAction.vue` mounts it on every
 * non-form page; the sticky form bar (`FormActions.vue`) does not host it — that
 * bar renders `FormAction*` buttons only.
 * See Documents/AQL_ACTION_SYSTEM.md and Documents/REPORTS_SYSTEM.md.
 *
 * Layer boundary: this component is presentation only. Every generation flow —
 * input-dialog state, dynamic select preloading, progress notifications, the
 * Base64 → Blob download — belongs to `useReports` and is only *invoked* here.
 *
 * Context adaptation: with a record in context (explicit `record` prop, else the
 * injected `resourceRecord`) it shows record-level reports; without one it shows
 * page-level (toolbar) reports. That is the same `isRecordLevel` split the legacy
 * `components/Reports/ResourceReports.vue` applies, so behaviour is unchanged.
 *
 * Self-contained by design: unlike FormActionSubmit/Reset/Cancel — which only
 * report intent upward so `PageAction.handleAction()` can dispatch through
 * `pageState` — a report download never touches `pageState`. Routing it through
 * the dispatcher would push report knowledge into the submission lifecycle, so it
 * calls `useReports` directly instead.
 *
 * Carries no `<style>` block — all rules are `.aql-report-action-*` in
 * `src/css/custom.scss` (ARCHITECTURE RULES §7).
 */
import { computed, inject } from 'vue'
import ReportInputDialog from 'components/app/ReportInputDialog.vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'
import { useReports } from 'src/composables/reports/useReports'

defineOptions({ name: 'ActionsResourceReports', inheritAttrs: false })

const props = defineProps({
  // 'fab' (floating) | 'toolbar' (dropdown) | 'card' (bordered bar) | 'inline' (bare buttons)
  mode:     { type: [String, Function], default: 'fab' },
  // Explicit record context. Null falls back to the injected resourceRecord, which
  // is what makes a page-level mount behave record-level on a View page.
  record:   { type: [Object, Function], default: null },

  // Resolver context — explicit props win, injected resourceConfig is the fallback.
  page:     { type: String, default: null },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null },

  // Report list override. When supplied it replaces the config-derived list, so a
  // page action config can declare exactly which reports appear.
  reports:  { type: [Array, Function], default: null },

  // Presentation (each also settable from a `resourcereports.js` JS modifier).
  // Teal reads as a distinct utility affordance next to the navy CRUD cluster
  // without competing with it the way the old deep-orange did.
  color:       { type: [String, Function], default: 'teal-7' },
  itemColor:   { type: [String, Function], default: 'teal-7' },
  textColor:   { type: [String, Function], default: 'white' },
  icon:        { type: [String, Function], default: 'picture_as_pdf' },
  // Short label rendered beside the icon, giving the FAB its pill footprint.
  label:       { type: [String, Function], default: 'Doc' },
  activeIcon:  { type: [String, Function], default: 'close' },
  tooltip:     { type: [String, Function], default: 'Download Reports' },
  position:    { type: [String, Function], default: 'bottom-left' },
  offset:      { type: [Array, Function], default: () => [18, 18] },

  // Visibility gates, mirroring the ResourceActions modifier contract.
  show:     { type: [Boolean, Function], default: true },
  hide:     { type: [Boolean, Function], default: false },
  // Page-contract gate, mirroring `noActions`. Honoured here as well as in
  // PageAction so a direct <Action action="ResourceReports" no-reports /> mount
  // and a `resourcereports.js` modifier both obey the same switch.
  noReports: { type: [Boolean, Function], default: false }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

function evalProp (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const resolvedMode       = computed(() => (evalProp(props.mode) || 'fab').toLowerCase())
const resolvedColor      = computed(() => evalProp(props.color))
const resolvedItemColor  = computed(() => evalProp(props.itemColor))
const resolvedTextColor  = computed(() => evalProp(props.textColor))
const resolvedLabel      = computed(() => evalProp(props.label))
const resolvedIcon       = computed(() => evalProp(props.icon))
const resolvedActiveIcon = computed(() => evalProp(props.activeIcon))
const resolvedTooltip    = computed(() => evalProp(props.tooltip))
const resolvedPosition   = computed(() => evalProp(props.position))
const resolvedOffset     = computed(() => evalProp(props.offset))

const resourceName = computed(() => resourceConfig?.resourceName?.value || '')
const config = computed(() => resourceConfig?.config?.value || null)

// Explicit prop wins; otherwise the page's injected record decides whether this
// mount is record-level or page-level.
const activeRecord = computed(() => evalProp(props.record) || resourceRecord?.record?.value || null)

const {
  isGenerating,
  showReportDialog,
  activeReport,
  reportInputs,
  getToolbarReports,
  getRecordReports,
  initiateReport,
  confirmReportDialog,
  cancelReportDialog
} = useReports(resourceName)

const displayedReports = computed(() => {
  const explicit = evalProp(props.reports)
  if (Array.isArray(explicit)) return explicit
  return activeRecord.value
    ? getRecordReports(config.value)
    : getToolbarReports(config.value)
})

// Nothing to download → render nothing at all, so an empty FAB never floats over
// a page whose resource has no reports configured.
const visible = computed(() => {
  if (evalProp(props.noReports) === true) return false
  if (evalProp(props.show) === false) return false
  if (evalProp(props.hide) === true) return false
  return displayedReports.value.length > 0
})

function reportLabel (report) {
  return report?.label || report?.name || 'Report'
}
</script>
