# PLAN: Refactor Common Page Orchestration and Section Override System
**Status**: DRAFT
**Created**: 2026-06-30
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity | pending)

## Objective
Update the AQL framework component customization pattern. Currently, page-level orchestrators dynamically resolve sub-sections, bypassing common fallbacks entirely when a local override exists. Under this new design:
1. Common page components (Index, Add, Edit, View, Action) become lightweight configuration shells.
2. A unified `Page.vue` orchestrator handles all state, reactivity, and context providers, statically rendering the layout sections.
3. Common section components (Header, Toolbar, Records, Details, etc.) are always executed. They prepare data and call `useSectionResolver` to check for local `.vue` templates (Tiers 1-8 custom template overrides) or `.js` composables (Tiers 1-8 prop modifiers).
4. If a local JS file exists, its exported function modifies the prepared props before they are fed into either the local template or the default common layout.

---

## Pre-Conditions
- [ ] Codebase index and rules were reviewed.
- [ ] No ongoing lock or merge conflict in `useSectionResolver.js`.

---

## Steps

### Step 1: Rename the Fallback Page
- [x] Rename [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Page.vue) to [PageFallback.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/PageFallback.vue).
- [x] Replace name and option strings in the renamed file from `Page` to `PageFallback`. (No internal 'Page' option strings found — file content preserved.)

**Files**: 
* [PageFallback.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/PageFallback.vue) (Renamed target)

---

### Step 2: Update `usePageResolver.js`
- [x] Modify [usePageResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageResolver.js) at line 111 to reference `PageFallback.vue` instead of `Page.vue`.

**Files**:
* [usePageResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageResolver.js)

#### Exact replacement at line 111:
```javascript
      // If no page resolved, fall back to global checklist/fallback page
      const fallbackPath = 'pages/_common/PageFallback.vue'
```

---

### Step 3: Create the New Unified `Page.vue`
- [x] Create the new dynamic orchestrator [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Page.vue) that handles data fetching, composables, provide/inject, and renders the statically mapped layout components according to the requested page action.

**Files**:
* [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Page.vue) [NEW]

#### Content for [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Page.vue):
```html
<template>
  <q-page class="q-gutter-y-sm" v-if="pageReady">
    <template v-for="sec in sections" :key="sec">
      <!-- 1. Header Section -->
      <component :is="getSectionComponent(sec, page)" v-if="sec === 'Header'" :page="page" />

      <!-- 2. ToolBar Section -->
      <component :is="getSectionComponent(sec, page)" v-if="sec === 'ToolBar'" :page="page" />

      <!-- 3. Content Section -->
      <template v-if="sec === 'Content'">
        <!-- Index Page Content -->
        <AqlContentWrapper v-if="page === 'Index'" :loading="loading" :empty="isEmpty" :has-data="items.length > 0">
          <component :is="getSectionComponent('Content', page)" :page="page" />
        </AqlContentWrapper>

        <!-- View Page Content -->
        <AqlContentWrapper v-slot="{ record }" v-else-if="page === 'View'" :loading="loading" :empty="false" requires-record :record-exists="!!record">
          <component :is="getSectionComponent('Content', page)" :page="page" />
        </AqlContentWrapper>

        <!-- Add Page Content -->
        <AqlContentWrapper v-else-if="page === 'Add'" :loading="false" :empty="false">
          <component
            :is="getSectionComponent('Content', page)"
            :page="page"
            :parent-form="parentForm"
            :child-groups="childGroups"
            :status-options="statusOptions"
            @update:field="(header, val) => { parentForm[header] = val }"
            @add-child="addChildRecord"
            @remove-child="removeChildRecord"
            @update-child-field="updateChildField"
          />
        </AqlContentWrapper>

        <!-- Edit Page Content -->
        <AqlContentWrapper v-slot="{ record }" v-else-if="page === 'Edit'" :loading="loading" :empty="false" requires-record :record-exists="!!record">
          <component
            :is="getSectionComponent('Content', page)"
            :page="page"
            :parent-form="parentForm"
            :child-groups="childGroups"
            :status-options="statusOptions"
            @update:field="(header, val) => { parentForm[header] = val }"
            @add-child="addChildRecord"
            @remove-child="removeChildRecord"
            @update-child-field="updateChildField"
          />
        </AqlContentWrapper>

        <!-- Action Page Content -->
        <AqlContentWrapper v-else-if="page === 'Action'"
          :loading="loading"
          :empty="false"
          requires-record
          :record-exists="!!record"
          empty-icon="block"
          empty-title="Action Unavailable"
          :empty-message="`Action &quot;${actionName}&quot; is not available or not configured for this record.`"
        >
          <q-card v-if="!currentActionConfig || !actionAllowedForRecord" flat bordered class="q-ma-md text-center q-py-xl">
            <q-card-section>
              <q-icon name="block" size="56px" color="grey-5" />
              <div class="text-h6 text-grey-7 q-mt-md">Action not available</div>
              <div class="text-caption text-grey-5 q-mt-sm">
                This action is either not configured or cannot be executed on the record in its current state.
              </div>
              <q-btn flat color="primary" label="Back" icon="arrow_back" class="q-mt-md" @click="navigateToView" />
            </q-card-section>
          </q-card>
          <component
            v-else
            :is="getSectionComponent('Content', page)"
            :page="page"
            :is-multi-outcome="isMockMultiOutcome"
            :outcome-options="outcomeOptions"
            :selected-outcome="selectedOutcome"
            :resolved-action-fields="resolvedActionFields"
            :action-form="actionForm"
            @update:selected-outcome="selectedOutcome = $event"
            @update:action-field="(header, val) => { actionForm[header] = val }"
          />
        </AqlContentWrapper>
      </template>

      <!-- 4. Action Section -->
      <template v-if="sec === 'Action'">
        <!-- Index / View Page Action -->
        <component :is="getSectionComponent('Action', page)" v-if="page === 'Index' || page === 'View'" :page="page" />

        <!-- Add Page Action -->
        <component
          v-else-if="page === 'Add'"
          :is="getSectionComponent('Action', page)"
          :page="page"
          submit-label="Create"
          :saving="saving"
          @cancel="navigateBack"
          @submit="handleSave"
        />

        <!-- Edit Page Action -->
        <component
          v-else-if="page === 'Edit'"
          :is="getSectionComponent('Action', page)"
          :page="page"
          submit-label="Update"
          :saving="saving"
          @cancel="navigateBack"
          @submit="handleSave"
        />

        <!-- Action Page Action -->
        <component
          v-else-if="page === 'Action' && currentActionConfig && actionAllowedForRecord"
          :is="getSectionComponent('Action', page)"
          :page="page"
          :action-label="currentActionConfig.label || actionName"
          :action-icon="currentActionConfig.icon || 'check'"
          :action-color="currentActionConfig.color || 'primary'"
          :submitting="submitting"
          :submit-disabled="isMockMultiOutcome && !selectedOutcome"
          @cancel="navigateToView"
          @submit="handleSubmit"
        />
      </template>
    </template>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, reactive, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useMasterActions } from 'src/composables/useMasterActions'
import { useOperationActions } from 'src/composables/useOperationActions'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

// Static Imports of All Fallback Sections
import Header from 'components/_common/Header/Header.vue'
import Toolbar from 'components/_common/Toolbar/Toolbar.vue'

// Contents
import IndexContent from 'components/_common/Index/Content.vue'
import ViewContent from 'components/_common/View/Content.vue'
import AddContent from 'components/_common/Add/Content.vue'
import EditContent from 'components/_common/Edit/Content.vue'
import ActionContent from 'components/_common/Action/Content.vue'

// Actions
import IndexActions from 'components/_common/Index/Actions.vue'
import ViewActions from 'components/_common/View/Actions.vue'
import AddActions from 'components/_common/Add/Actions.vue'
import EditActions from 'components/_common/Edit/Actions.vue'
import ActionActions from 'components/_common/Action/Actions.vue'

defineOptions({ name: 'PageLayoutContainer' })

const props = defineProps({
  page: { type: String, required: true },
  sections: { type: Array, required: true }
})

const router = useRouter()
const nav = useResourceNav()

const resourceConfig = useResourceConfig()
const resourceRecord = useRecord()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

const { scope, resourceSlug, code, config, resourceName, resourceHeaders, additionalActions } = resourceConfig
const { record, records: items, loading, reload, loadRelations, childRecordsByResource } = resourceRecord

const isEmpty = computed(() => !loading.value && items.value.length === 0)
const pageReady = ref(true)

// Helper mapping function to resolve which components to load statically
function getSectionComponent(secName, pageName) {
  if (secName === 'Header') return Header
  if (secName === 'ToolBar') return Toolbar
  if (secName === 'Content') {
    if (pageName === 'Index') return IndexContent
    if (pageName === 'View') return ViewContent
    if (pageName === 'Add') return AddContent
    if (pageName === 'Edit') return EditContent
    if (pageName === 'Action') return ActionContent
  }
  if (secName === 'Action') {
    if (pageName === 'Index') return IndexActions
    if (pageName === 'View') return ViewActions
    if (pageName === 'Add') return AddActions
    if (pageName === 'Edit') return EditActions
    if (pageName === 'Action') return ActionActions
  }
  return null
}

// Form logic setup
const {
  parentForm, childGroups, saving, statusOptions,
  initializeForCreate, initializeForEdit, addChildRecord, removeChildRecord,
  updateChildField, save
} = useCompositeForm(config)

onMounted(() => {
  if (props.page === 'Add') {
    initializeForCreate()
  }
})

async function loadAndInitializeEdit() {
  await reload()
  if (!record.value) return
  await loadRelations()
  initializeForEdit(record.value, childRecordsByResource.value)
}

// Reactively load records/relations depending on page view context
watch(
  () => [resourceName.value, code.value, props.page],
  async ([newName, newCode, pageName]) => {
    if (newName) {
      if (pageName === 'Index') {
        await reload()
      } else if (pageName === 'View') {
        await reload()
        if (record.value) {
          await loadRelations()
        }
      } else if (pageName === 'Edit' && newCode) {
        await loadAndInitializeEdit()
      } else if (pageName === 'Action') {
        await reload()
      }
    }
  },
  { immediate: true }
)

async function handleSave() {
  const response = await save()
  if (response.success) {
    if (props.page === 'Edit') {
      nav.goTo('view')
    } else {
      const newCode = response.data?.code || response.data?.parentCode
      if (newCode) {
        nav.goTo('view', { code: newCode })
      } else {
        nav.goTo('index')
      }
    }
  }
}

function navigateBack() {
  if (props.page === 'Edit') {
    nav.goTo('view')
  } else {
    nav.goTo('index')
  }
}

// Action execution specific logic setup
const isOps = computed(() => scope.value?.toLowerCase() === 'operations')
const masterActions = useMasterActions()
const operationActions = useOperationActions()

const actionsStore = computed(() => isOps.value ? operationActions : masterActions)
const submitting = computed(() => actionsStore.value.submitting.value)

const actionName = computed(() => {
  const route = router.currentRoute.value
  return route.params.action || route.meta?.action || ''
})

const currentActionConfig = computed(() => {
  return additionalActions.value.find(
    (a) => a.action.toLowerCase() === actionName.value.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

const selectedOutcome = ref('')
const actionForm = reactive({})
const {
  column, isMultiOutcome: isMockMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields
} = useActionFields(resourceHeaders, currentActionConfig, () => selectedOutcome.value)

const actionAllowedForRecord = computed(() =>
  !currentActionConfig.value || isActionVisible(currentActionConfig.value, record.value)
)

watch(currentActionConfig, (cfg) => {
  selectedOutcome.value = cfg?.columnValue || ''
}, { immediate: true })

watch(resolvedActionFields, (fields) => {
  Object.keys(actionForm).forEach((k) => delete actionForm[k])
  fields.forEach((f) => { actionForm[f.header] = '' })
}, { immediate: true })

async function handleSubmit() {
  await actionsStore.value.submitAction({
    resourceName: resourceName.value,
    code: code.value,
    actionConfig: {
      ...currentActionConfig.value,
      column: column.value,
      columnValue: selectedOutcome.value
    },
    selectedOutcome: selectedOutcome.value,
    fields: { ...actionForm },
    resolvedFields: resolvedActionFields.value,
    onSuccess: async () => nav.goTo('view')
  })
}

function navigateToView() {
  nav.goTo('view')
}
</script>
