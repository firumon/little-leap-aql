<template>
  <div>
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />

    <!-- Added-records list (inline + popup modes) — positioned via listPosition -->
    <AppList
      v-if="showList && showListTop"
      v-bind="listBindings"
      :class="listClassTop"
    >
      <template #empty>
        <div :class="emptyClass">{{ resolvedEmptyText }}</div>
      </template>
      <template #btn="{ item }">
        <div class="row no-wrap q-gutter-xs">
          <q-btn
            flat round dense :size="actionBtnSize" :icon="editIcon" :color="editColor"
            :disable="editIndex === bucketIndexOf(item)"
            @click="startEdit(bucketIndexOf(item))"
          />
          <q-btn
            flat round dense :size="actionBtnSize" :icon="deleteIcon" :color="deleteColor"
            @click="remove(bucketIndexOf(item))"
          />
        </div>
      </template>
    </AppList>

    <!-- INLINE (default): entry form always visible -->
    <q-card
      v-if="mode === 'inline'"
      :flat="cardFlat" :bordered="cardBordered"
      :class="[cardClass, 'q-mb-sm']"
    >
      <q-card-section>
        <FormRecord v-bind="formRecordBindings(draft)" @update:field="onDraftField" />
        <div class="row justify-end q-gutter-sm q-mt-sm">
          <q-btn
            v-if="editIndex !== null"
            flat no-caps :label="cancelLabel" :color="cancelColor"
            @click="resetDraft"
          />
          <q-btn
            unelevated no-caps :color="submitColor"
            :icon="editIndex !== null ? updateIcon : addIcon"
            :label="editIndex !== null ? updateLabel : inlineAddLabel"
            :disable="!canSubmit || (editIndex === null && maxReached)"
            @click="submitDraft"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- POPUP: add/edit through a dialog -->
    <template v-if="mode === 'popup'">
      <div class="row justify-end q-mt-sm">
        <q-btn
          unelevated no-caps :color="submitColor" :icon="addIcon"
          :label="inlineAddLabel"
          :disable="maxReached"
          @click="openDialog"
        />
      </div>

      <q-dialog v-model="dialogOpen" @hide="resetDraft">
        <q-card class="full-width" :style="dialogStyle">
          <q-card-section class="row items-center q-pb-none">
            <div :class="dialogTitleClass">
              {{ editIndex !== null ? dialogEditTitle : dialogAddTitle }}
            </div>
            <q-space />
            <q-btn v-close-popup flat round dense :icon="closeIcon" />
          </q-card-section>
          <q-card-section>
            <FormRecord v-bind="formRecordBindings(draft)" @update:field="onDraftField" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps :label="cancelLabel" :color="cancelColor" />
            <q-btn
              unelevated no-caps :color="submitColor"
              :label="editIndex !== null ? updateLabel : addLabel"
              :disable="!canSubmit || (editIndex === null && maxReached)"
              @click="submitDraft"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>

    <!-- Added-records list rendered below the entry form/button when listPosition is bottom -->
    <AppList
      v-if="showList && !showListTop"
      v-bind="listBindings"
      :class="listClassBottom"
    >
      <template #empty>
        <div :class="emptyClass">{{ resolvedEmptyText }}</div>
      </template>
      <template #btn="{ item }">
        <div class="row no-wrap q-gutter-xs">
          <q-btn
            flat round dense :size="actionBtnSize" :icon="editIcon" :color="editColor"
            :disable="editIndex === bucketIndexOf(item)"
            @click="startEdit(bucketIndexOf(item))"
          />
          <q-btn
            flat round dense :size="actionBtnSize" :icon="deleteIcon" :color="deleteColor"
            @click="remove(bucketIndexOf(item))"
          />
        </div>
      </template>
    </AppList>

    <!-- MULTI: one live form per added row -->
    <template v-if="mode === 'multi'">
      <TransitionGroup :name="transitionName">
        <q-card
          v-for="(row, index) in visibleRecords"
          :key="rowKey(row)"
          :flat="cardFlat" :bordered="cardBordered"
          :class="[cardClass, 'q-mb-sm']"
        >
          <q-card-section>
            <div class="row items-center justify-between q-mb-xs">
              <!-- `index` is the VISIBLE index (gap-free numbering); every mutation
                   below re-resolves the true bucket index via `bucketIndexOf`. -->
              <div :class="rowTitleClass">{{ rowTitle(index) }}</div>
              <q-btn
                flat round dense :size="actionBtnSize" :icon="deleteIcon" :color="deleteColor"
                @click="remove(bucketIndexOf(row))"
              />
            </div>
            <FormRecord
              v-bind="formRecordBindings(row.data)"
              @update:field="(header, value) => onRowField(bucketIndexOf(row), header, value)"
            />
          </q-card-section>
        </q-card>
      </TransitionGroup>
      <div class="row justify-center q-mt-sm">
        <q-btn
          outline no-caps :color="submitColor" :icon="addIcon"
          :label="inlineAddLabel"
          :disable="maxReached"
          @click="addBlankRow"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, inject, useAttrs } from 'vue'
import { useQuasar } from 'quasar'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import FormRecord from 'components/contents/FormRecord.vue'
import { resolveChildFields, resolveChildTitle, toPascalCase } from 'src/utils/appHelpers'

// Child-record entry container for Create/Update; every mutation lands in pageState's child bucket.
defineOptions({ name: 'ContentsFormChild', inheritAttrs: false })

const props = defineProps({
  childResource: { type: Object, required: true },
  parentResource: { type: String, required: true },
  childMode: {
    type: String,
    default: 'inline',
    validator: (v) => ['inline', 'popup', 'multi', 'multiple'].includes(v)
  },
  listPosition: {
    type: String,
    default: 'top',
    validator: (v) => ['top', 'above', 'bottom', 'below'].includes(v)
  },
  closeOnAdd: { type: Boolean, default: true },
  // 0 = unlimited; 1 for 1-to-1 child relations (e.g. Outlet -> OutletOperatingRules).
  maxRecords: { type: Number, default: 0 },
  hideFields: { type: Array, default: () => [] },
  // Highest-precedence visibility switch — forced visible on child forms.
  showFields: { type: Array, default: () => [] },
  // Code is server-generated, so hidden by default.
  showCode: { type: Boolean, default: false },
  columns: { type: Number, default: 1 },
  title: { type: String, default: '' },

  // ── Forwarded to every inner FormRecord ──────────────────────────────────
  fields: { type: Array, default: null },
  workflowFields: { type: [String, Boolean], default: 'hide' },
  showStatus: { type: [Boolean, String], default: false },
  statusDefault: { type: String, default: 'Active' },
  defaultValues: { type: [Object, Function], default: () => ({}) },
  fieldProps: { type: [Object, Function], default: () => ({}) },
  formRecordProps: { type: Object, default: () => ({}) },

  // ── List rendering ───────────────────────────────────────────────────────
  listProps: { type: Object, default: () => ({}) },
  listDense: { type: Boolean, default: true },
  listSeparator: { type: Boolean, default: true },
  listBordered: { type: Boolean, default: false },
  listClassTop: { type: [String, Array, Object], default: 'q-mb-sm' },
  listClassBottom: { type: [String, Array, Object], default: 'q-mt-sm' },
  itemLabel: { type: [String, Function], default: null },
  itemCaption: { type: [String, Function], default: null },
  captionParts: { type: Number, default: 3 },
  captionSeparator: { type: String, default: ' • ' },
  // Fallback label for a row with no filled fields yet.
  newItemLabel: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  emptyClass: { type: [String, Array, Object], default: 'text-caption text-grey-6 text-center q-py-xs' },

  // ── Card styling ─────────────────────────────────────────────────────────
  cardClass: { type: [String, Array, Object], default: 'aql-premium-gradient-form' },
  cardFlat: { type: Boolean, default: true },
  cardBordered: { type: Boolean, default: true },
  rowTitleClass: { type: [String, Array, Object], default: 'text-caption text-weight-medium text-grey-7' },
  transitionName: { type: String, default: 'aql-list-item' },

  // ── Dialog ───────────────────────────────────────────────────────────────
  dialogStyle: { type: [String, Object], default: 'max-width: 520px' },
  dialogTitleClass: { type: [String, Array, Object], default: 'text-subtitle1 text-weight-medium' },
  dialogAddTitleLabel: { type: String, default: '' },
  dialogEditTitleLabel: { type: String, default: '' },

  // ── Labels / icons / colours ─────────────────────────────────────────────
  addLabel: { type: String, default: 'Add' },
  updateLabel: { type: String, default: 'Update' },
  cancelLabel: { type: String, default: 'Cancel' },
  addIcon: { type: String, default: 'add' },
  updateIcon: { type: String, default: 'check' },
  editIcon: { type: String, default: 'edit' },
  deleteIcon: { type: String, default: 'delete' },
  closeIcon: { type: String, default: 'close' },
  submitColor: { type: String, default: 'primary' },
  cancelColor: { type: String, default: 'grey-7' },
  editColor: { type: String, default: 'primary' },
  deleteColor: { type: String, default: 'negative' },
  actionBtnSize: { type: String, default: 'sm' },

  // ── Undo for soft-deleted rows (a notification, since the row itself is hidden) ──
  undoRemove: { type: Boolean, default: true },
  undoLabel: { type: String, default: 'Undo' },
  // Defaults to `${resolvedTitle} removed` when left empty.
  undoMessage: { type: String, default: '' },
  undoColor: { type: String, default: 'grey-9' },
  undoTextColor: { type: String, default: 'white' },
  undoBtnColor: { type: String, default: 'amber' },
  undoTimeout: { type: Number, default: 5000 },
  undoPosition: { type: String, default: 'bottom' }
})

const $q = useQuasar()
const attrs = useAttrs()

const pageState = inject('pageState', null)
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

function modifierContext () {
  return { pageState, resourceConfig, resourceRecord }
}

// Visible rows only, so a soft-deleted row frees its slot for a replacement.
const maxReached = computed(() => props.maxRecords > 0 && visibleRecords.value.length >= props.maxRecords)

const mode = computed(() => (props.childMode === 'multiple' ? 'multi' : props.childMode))
const showList = computed(() => mode.value !== 'multi')
const showListTop = computed(() => ['top', 'above'].includes(props.listPosition))
const childName = computed(() => props.childResource?.name || '')
const resolvedTitle = computed(() => props.title || resolveChildTitle(props.childResource))

// Derived labels (each overrideable by its own prop).
const inlineAddLabel = computed(() => `${props.addLabel} ${resolvedTitle.value}`.trim())
const dialogAddTitle = computed(
  () => props.dialogAddTitleLabel || `${props.addLabel} ${resolvedTitle.value}`.trim()
)
const dialogEditTitle = computed(
  () => props.dialogEditTitleLabel || `Edit ${resolvedTitle.value}`.trim()
)
const resolvedEmptyText = computed(
  () => props.emptyText || `No ${resolvedTitle.value} added yet.`
)
function rowTitle (index) {
  return `${resolvedTitle.value} ${index + 1}`
}

// Content-resolver identity for the child resource's own FormRecord/FormField overrides.
const uiName = computed(() => resourceConfig?.customUIName?.value || '')
const fieldScope = computed(() => props.childResource?.scope || resourceConfig?.scope?.value || '')
// Normalized like useContentResolver.js so kebab-case slugs match the glob registry keys.
const fieldResourceSlug = computed(
  () => toPascalCase(props.childResource?.slug || childName.value).toLowerCase()
)

const effectiveHideFields = computed(() => {
  const hidden = new Set(props.hideFields)
  // showFields wins over hideFields here too, mirroring FormRecord's chain.
  for (const header of props.showFields) hidden.delete(header)
  return [...hidden]
})

// Mirrors FormRecord's Code/showFields precedence so label/caption/required logic matches what it renders.
const displayHiddenFields = computed(() => {
  const hidden = new Set(effectiveHideFields.value)
  if (!props.showCode) hidden.add('Code')
  for (const header of props.showFields) hidden.delete(header)
  return [...hidden]
})

// Precedence: $attrs, then explicit props, then the caller's formRecordProps.
function formRecordBindings (record) {
  return {
    ...attrs,
    resource: childName.value,
    record,
    hideFields: effectiveHideFields.value,
    showFields: props.showFields,
    showCode: props.showCode,
    fields: props.fields,
    workflowFields: props.workflowFields,
    showStatus: props.showStatus,
    statusDefault: props.statusDefault,
    defaultValues: props.defaultValues,
    fieldProps: props.fieldProps,
    columns: props.columns,
    scope: fieldScope.value,
    resourceSlug: fieldResourceSlug.value,
    uiName: uiName.value,
    card: false,
    ...props.formRecordProps
  }
}

// `content` is dropped: $attrs carries the content-resolver identity string, but AppList expects an Array.
const listBindings = computed(() => {
  const { content, ...restAttrs } = attrs
  return {
    ...restAttrs,
    items: visibleRecords.value,
    itemKey: rowKey,
    label: props.itemLabel || defaultItemLabel,
    caption: props.itemCaption || defaultItemCaption,
    dense: props.listDense,
    separator: props.listSeparator,
    bordered: props.listBordered,
    ...props.listProps
  }
})

const childFields = computed(() =>
  resolveChildFields(props.childResource).filter(
    (f) => f && f.header && !displayHiddenFields.value.includes(f.header)
  )
)

// ── pageState child bucket (single source of truth for added records) ────────
// Bound once with getters, so it follows both parentResource and childName.
const parentNode = pageState?.useNode(() => props.parentResource) || null
const childRecords = parentNode?.children(() => childName.value) || null
const records = computed(() => childRecords?.value || [])

// Soft-deleted rows stay in `records` for the payload but are hidden from every list, loop, and count.
const visibleRecords = computed(() => records.value.filter((r) => r._action !== 'deactivate'))

// Rendered row -> bucket index; identity lookup, since visible rows are the same reactive objects.
function bucketIndexOf (row) {
  return records.value.indexOf(row)
}

// Needs a Code: GAS matches on it, and without one it would create a duplicate instead of deactivating.
function isPersistedRow (row) {
  return row?._action === 'update' && !!String(row?.data?.Code ?? '').trim()
}

// Stable AppList/TransitionGroup keys for wrapper objects that carry no id of their own.
const rowKeys = new WeakMap()
let keySeq = 0
function rowKey (row) {
  if (!rowKeys.has(row)) rowKeys.set(row, `fc-row-${++keySeq}`)
  return rowKeys.get(row)
}

// Seeds every new row/draft, not just the first mount. Precedence: backend defaults < props < Status fallback.
function createChildDefaultRecord () {
  const backend = props.childResource?.defaultValues
  const ctx = modifierContext()
  const seedBase = {}

  let resolved = props.defaultValues
  if (typeof resolved === 'function') {
    try {
      resolved = resolved(seedBase, ctx)
    } catch (err) {
      console.error('[FormChild] defaultValues function failed:', err)
      resolved = {}
    }
  }
  if (!resolved || typeof resolved !== 'object') resolved = {}

  const out = { ...(backend && typeof backend === 'object' ? backend : {}) }
  for (const [header, value] of Object.entries(resolved)) {
    if (typeof value === 'function') {
      try {
        out[header] = value(seedBase, ctx)
      } catch (err) {
        console.error(`[FormChild] defaultValues["${header}"] function failed:`, err)
        continue
      }
    } else {
      out[header] = value
    }
  }

  const hasStatusField = resolveChildFields(props.childResource).some((f) => f?.header === 'Status')
  const statusVisible = props.showStatus === true || props.showStatus === 'show' || props.showFields.includes('Status')
  if (hasStatusField && !statusVisible && out.Status === undefined && props.statusDefault !== null) {
    out.Status = props.statusDefault
  }
  return out
}

// ── Draft entry (inline + popup modes) ────────────────────────────────────────
const draft = ref(createChildDefaultRecord())
const editIndex = ref(null)
const dialogOpen = ref(false)

const requiredFields = computed(() => {
  const raw = props.childResource?.requiredHeaders || ''
  const fromConfig = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const fromFields = childFields.value.filter((f) => f.required).map((f) => f.header)
  return [...new Set([...fromConfig, ...fromFields])]
    .filter((h) => !displayHiddenFields.value.includes(h))
})

const hasAnyValue = computed(() =>
  Object.values(draft.value).some((v) => v !== undefined && v !== null && v !== '')
)

const canSubmit = computed(() =>
  hasAnyValue.value &&
  requiredFields.value.every((h) => {
    const v = draft.value[h]
    return v !== undefined && v !== null && v !== ''
  })
)

function onDraftField (header, value) {
  draft.value[header] = value
}

function resetDraft () {
  draft.value = createChildDefaultRecord()
  editIndex.value = null
}

function submitDraft () {
  if (!canSubmit.value || !pageState) return
  const wasEdit = editIndex.value !== null
  if (!wasEdit && maxReached.value) return
  if (wasEdit) {
    // editIndex is already a bucket index — no visible->bucket mapping needed.
    pageState.updateChild(props.parentResource, childName.value, editIndex.value, { ...draft.value })
  } else {
    pageState.addChild(props.parentResource, childName.value, { ...draft.value })
  }
  resetDraft()
  if (mode.value === 'popup' && (props.closeOnAdd || wasEdit)) dialogOpen.value = false
}

// `index` is a BUCKET index (the template resolves it via `bucketIndexOf`).
function startEdit (index) {
  const row = records.value[index]
  if (!row || row._action === 'deactivate') return
  draft.value = { ...row.data }
  editIndex.value = index
  if (mode.value === 'popup') dialogOpen.value = true
}

function openDialog () {
  resetDraft()
  dialogOpen.value = true
}

// Re-resolves the index at click time: the undo notification outlives the call to
// remove(), so a row added/removed meanwhile would invalidate a captured index.
function restore (row) {
  if (!pageState || !row || row._action !== 'deactivate') return
  const index = bucketIndexOf(row)
  if (index < 0) return
  pageState.setChildAction(props.parentResource, childName.value, index, 'update')
}

function notifyUndo (row) {
  if (!props.undoRemove) return
  $q.notify({
    message: props.undoMessage || `${resolvedTitle.value} removed`.trim(),
    color: props.undoColor,
    textColor: props.undoTextColor,
    position: props.undoPosition,
    timeout: props.undoTimeout,
    actions: [{
      label: props.undoLabel,
      color: props.undoBtnColor,
      noCaps: true,
      handler: () => restore(row)
    }]
  })
}

// `index` is a BUCKET index. Persisted rows soft-delete in place; session-added rows splice out.
function remove (index) {
  if (!pageState) return
  const row = records.value[index]
  if (!row) return

  if (isPersistedRow(row)) {
    pageState.setChildAction(props.parentResource, childName.value, index, 'deactivate')
    // No splice, so no index shifts — only an in-flight edit of this row needs clearing.
    if (editIndex.value === index) resetDraft()
    notifyUndo(row)
    return
  }

  pageState.removeChild(props.parentResource, childName.value, index)
  if (editIndex.value === index) resetDraft()
  else if (editIndex.value !== null && editIndex.value > index) editIndex.value -= 1
}

// ── Multi mode: rows bound straight to pageState records ─────────────────────
function addBlankRow () {
  if (!pageState || maxReached.value) return
  pageState.addChild(props.parentResource, childName.value, createChildDefaultRecord())
}

// `index` is a BUCKET index (resolved by `bucketIndexOf` in the v-for).
function onRowField (index, header, value) {
  if (!pageState) return
  if (index < 0) return
  pageState.updateChild(props.parentResource, childName.value, index, { [header]: value })
}

// ── Added-record list display (AppList label/caption resolvers) ─────────────
function displayValue (value) {
  if (value && typeof value === 'object') return value.Name ?? value.Code ?? ''
  return value ?? ''
}

function defaultItemLabel (row) {
  const data = row?.data
  for (const field of childFields.value) {
    const v = displayValue(data?.[field.header])
    if (v !== '' && v !== null && v !== undefined) return v
  }
  return props.newItemLabel || `New ${resolvedTitle.value}`
}

function defaultItemCaption (row) {
  const data = row?.data
  const labelHeader = childFields.value.find(
    (f) => displayValue(data?.[f.header]) !== ''
  )?.header
  const parts = []
  for (const field of childFields.value) {
    if (field.header === labelHeader) continue
    const v = displayValue(data?.[field.header])
    if (v === '' || v === null || v === undefined) continue
    parts.push(`${field.label || field.header}: ${v}`)
    if (parts.length >= props.captionParts) break
  }
  return parts.join(props.captionSeparator)
}
</script>
