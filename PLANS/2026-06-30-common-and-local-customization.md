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
- [ ] Rename [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Page.vue) to [PageFallback.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/PageFallback.vue).
- [ ] Replace name and option strings in the renamed file from `Page` to `PageFallback`.

**Files**:
* [PageFallback.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/PageFallback.vue) (Renamed target)

---

### Step 2: Update `usePageResolver.js`
- [ ] Modify [usePageResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageResolver.js) at line 111 to reference `PageFallback.vue` instead of `Page.vue`.

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
```

---

### Step 4: Re-write `useSectionResolver.js`
- [x] Completely replace [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js) to scan Tiers 1-8 for custom Vue templates and JS logic modifier files. Expose `resolvedComponent` and `propModifier` directly for common components to consume.

**Files**:
* [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js)

#### Replacement content:
```javascript
import { computed, ref, shallowRef, watch, markRaw, inject } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

// Vite statically discovers all component Vue and JS files under src/components
const sectionModules = import.meta.glob('../../components/**/*.{vue,js}')

// Build normalized registry (e.g., "components/_common/List/Header.vue")
export const registry = {}
Object.keys(sectionModules).forEach((rawPath) => {
  const normalizedKey = rawPath.replace(/^\.\.\/\.\.\/components\//, 'components/')
  registry[normalizedKey] = sectionModules[rawPath]
})

/**
 * Resolves local custom Vue (template-only) and JS (logic modifier) section files using Tiers 1-8 lookup.
 */
async function resolveSectionOverride(entityName, sectionName, customUIName, scope, page) {
  const scopeFolder = toPascalCase(scope)
  const candidates = []

  function addPaths(dir) {
    candidates.push(`${dir}/${sectionName}`)
  }

  // Tiers 1-8 Resolution checklist (custom/local overrides only, no common fallbacks):
  if (customUIName) {
    // Tier 1: Tenant-custom, Entity-specific, Page-specific
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}/${page}`)
    // Tier 2: Tenant-custom, Entity-specific, Page-generic
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${entityName}`)
    // Tier 3: Tenant-custom, Scope-common, Page-specific
    addPaths(`components/_custom/${customUIName}/${scopeFolder}/${page}`)
    // Tier 4: Tenant-custom, Global Page-specific (Scope-generic)
    addPaths(`components/_custom/${customUIName}/${page}`)
    // Tier 5: Tenant-custom, Scope-common, Page-generic
    addPaths(`components/_custom/${customUIName}/${scopeFolder}`)
    // Tier 6: Tenant-custom, Tenant-global
    addPaths(`components/_custom/${customUIName}`)
  }

  // Tier 7: Entity-custom, Page-specific
  addPaths(`components/${scopeFolder}/${entityName}/${page}`)
  // Tier 8: Entity-custom, Page-generic
  addPaths(`components/${scopeFolder}/${entityName}`)

  let resolvedVue = null
  let resolvedJs = null

  // Check the checklist in order
  for (const basePath of candidates) {
    const vuePath = `${basePath}.vue`
    const jsPath = `${basePath}.js`

    // Look for Vue template
    if (registry[vuePath] && !resolvedVue) {
      try {
        const module = await registry[vuePath]()
        const comp = module.default || module
        const hasTemplate = !!(comp && (comp.render || comp.ssrRender || typeof comp === 'function'))
        if (hasTemplate) {
          resolvedVue = comp
        }
      } catch (err) {
        console.error(`Failed to load Vue override at ${vuePath}:`, err)
      }
    }

    // Look for JS logic modifier
    if (registry[jsPath] && !resolvedJs) {
      try {
        const module = await registry[jsPath]()
        resolvedJs = module.default || module
      } catch (err) {
        console.error(`Failed to load JS override at ${jsPath}:`, err)
      }
    }

    // Stop searching once we have resolved both components
    if (resolvedVue && resolvedJs) {
      break
    }
  }

  return { resolvedVue, resolvedJs }
}

/**
 * Resolves custom Vue and JS overrides for a single section.
 */
export function useSectionResolver({ sectionName, page }) {
  const resourceConfig = inject('resourceConfig', null)

  const resourceSlug = computed(() => resourceConfig?.resourceSlug?.value || '')
  const customUIName = computed(() => resourceConfig?.customUIName?.value || '')
  const scope = computed(() => resourceConfig?.scope?.value || 'masters')

  const resolvedComponent = shallowRef(null)
  const propModifier = shallowRef((props) => props)
  const sectionsReady = ref(false)

  async function resolve() {
    sectionsReady.value = false
    const entityName = toPascalCase(resourceSlug.value)

    if (!resourceSlug.value) {
      resolvedComponent.value = null
      propModifier.value = (props) => props
      sectionsReady.value = true
      return
    }

    const { resolvedVue, resolvedJs } = await resolveSectionOverride(
      entityName,
      sectionName,
      customUIName.value,
      scope.value,
      page
    )

    resolvedComponent.value = resolvedVue ? markRaw(resolvedVue) : null
    propModifier.value = resolvedJs || ((props) => props)
    sectionsReady.value = true
  }

  watch(
    () => [resourceSlug.value, customUIName.value, scope.value, page],
    async () => {
      await resolve()
    },
    { immediate: true }
  )

  return {
    resolvedComponent,
    propModifier,
    sectionsReady
  }
}
```

---

### Step 5: Convert Common Pages into Lightweight Configuration Shells
- [x] Replace the full code of the 6 common page components with lightweight shells rendering `<Page />`.

**Files**:
* [IndexPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/IndexPage.vue)
* [AddPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/AddPage.vue)
* [EditPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/EditPage.vue)
* [ActionPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/ActionPage.vue)
* [ViewPage.vue (Masters)](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Masters/ViewPage.vue)
* [ViewPage.vue (Operations)](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Operations/ViewPage.vue)

#### 5.1 [IndexPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/IndexPage.vue) code:
```html
<template>
  <Page page="Index" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonIndexPage' })
</script>
```

#### 5.2 [AddPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/AddPage.vue) code:
```html
<template>
  <Page page="Add" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonAddPage' })
</script>
```

#### 5.3 [EditPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/EditPage.vue) code:
```html
<template>
  <Page page="Edit" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonEditPage' })
</script>
```

#### 5.4 [ActionPage.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/ActionPage.vue) code:
```html
<template>
  <Page page="Action" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonActionPage' })
</script>
```

#### 5.5 [ViewPage.vue (Masters)](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Masters/ViewPage.vue) code:
```html
<template>
  <Page page="View" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'MastersViewPage' })
</script>
```

#### 5.6 [ViewPage.vue (Operations)](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/_common/Operations/ViewPage.vue) code:
```html
<template>
  <Page page="View" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'OperationsViewPage' })
</script>
```

---

### Step 6: Refactor Common Section Components for Self-Resolution
- [x] For each common fallback component, modify its setup block to call the new `useSectionResolver` contract, prepare data, compute `finalProps = propModifier(preparedProps)`, and dynamically render the `resolvedComponent` if present.

Note: Header.vue and Records.vue refactored to use new contract; other sections will be migrated incrementally.

**Files**:
* [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Header/Header.vue)
* [Records.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Records.vue)

#### 6.1 [Header.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Header/Header.vue) Refactoring:
Replace the template and resolver script lines in `Header.vue`.

##### Replace template (Lines 1-26) with:
```html
<template>
  <!-- Case 1: Local header template exists -> Render it directly with modified props -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Case 2: Standard fallback using the shared GenericHeaderPanel -->
  <GenericHeaderPanel
    v-else
    :label="finalProps.label"
    :caption="finalProps.caption"
    :icon="finalProps.icon"
    :back="finalProps.back"
    :back-icon="finalProps.backIcon"
    :reload="finalProps.reload"
    :reload-component="finalProps.reloadComponent"
    :reload-icon="finalProps.reloadIcon"
    :chip="finalProps.chip"
    :chip-color="finalProps.chipColor"
    :chip-text-color="finalProps.chipTextColor"
    :chip-component="finalProps.chipComponent"
    @click="navigateBack"
  />
</template>
```

##### Replace resolver setup (Lines 63-94) in `<script setup>` with:
```javascript
const props = defineProps({
  page: { type: String, default: 'View' }
})

// Resolve the local header component using the single-section resolver
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Header',
  page: props.page
})

// 1. Title Resolution
const rawTitle = computed(() => {
  if (isIndexPage.value) return activeConfig.value?.name || ''
  const act = currentAction.value
  if (act === 'add') return activeConfig.value?.name ? `New ${activeConfig.value.name}` : 'New Record'
  if (act === 'edit') return activeConfig.value?.name ? `Edit ${activeConfig.value.name}` : 'Edit Record'
  if (act === 'action') return activeActionConfig.value?.label || 'Action'
  return activeConfig.value?.name || 'Record'
})

// 2. Subtitle Resolution
const rawSubtitle = computed(() => {
  if (isIndexPage.value) return activeConfig.value?.description || ''
  const act = currentAction.value
  if (act === 'add') return 'Create a new entry'
  const rCode = recordCode.value
  if (act === 'edit') return rCode ? `${rCode} - Modify` : 'Modify details'
  if (act === 'action') return rCode ? `${rCode} - Action` : 'Run workflow action'
  return rCode ? `${rCode} - Details` : 'Details'
})

// 3. Left Icon Resolution
const rawIcon = computed(() => activeConfig.value?.ui?.header?.icon || null)

// 4. Back Configuration
const rawBackConfig = computed(() => {
  const val = activeConfig.value?.ui?.header?.back
  let showBack = false
  let icon = 'arrow_back'
  let actionFn = null
  if (val === false || val === 'false') {
    showBack = false
  } else if (typeof val === 'function') {
    showBack = true
    actionFn = val
  } else if (typeof val === 'string' && val !== 'true' && val !== 'false') {
    showBack = true
    icon = val
  } else {
    const hasHistory = !!window.history.state?.back
    showBack = hasHistory || currentAction.value !== 'index'
  }
  return { showBack, icon, actionFn }
})

// 5. Reload Configuration
const rawReload = computed(() => {
  const val = activeConfig.value?.ui?.header?.reload
  if (val === false || val === 'false') return false
  if (val) return true
  return isIndexPage.value
})

const rawReloadIcon = computed(() => {
  const val = activeConfig.value?.ui?.header?.reload
  if (typeof val === 'string' && val !== 'true' && val !== 'false') return val
  return 'refresh'
})

// 6. Status Chip Resolution
const rawChip = computed(() => evaluate(activeConfig.value?.ui?.header?.chip) || '')
const rawChipColor = computed(() => evaluate(activeConfig.value?.ui?.header?.chipColor) || 'primary')
const rawChipTextColor = computed(() => evaluate(activeConfig.value?.ui?.header?.chipTextColor) || 'white')

// Bundle prepared props
const preparedProps = computed(() => ({
  label: rawTitle.value,
  caption: rawSubtitle.value,
  icon: rawIcon.value,
  back: rawBackConfig.value.showBack,
  backIcon: rawBackConfig.value.icon,
  reload: rawReload.value,
  reloadComponent: null,
  reloadIcon: rawReloadIcon.value,
  chip: rawChip.value,
  chipColor: rawChipColor.value,
  chipTextColor: rawChipTextColor.value,
  chipComponent: null
}))

// Apply JS logic modifier
const finalProps = computed(() => propModifier.value(preparedProps.value))
```

#### 6.2 [Records.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_common/Content/Records.vue) Refactoring:
Replace template and resolver script lines in `Records.vue`.

##### Replace template (Lines 1-49) with:
```html
<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback card layout -->
  <q-card
    v-else
    :flat="finalProps.flat !== false"
    :bordered="finalProps.bordered !== false"
    :class="['records-card q-mt-sm', finalProps.class]"
  >
    <q-card-section class="q-pa-none">
      <div v-if="loading && !items.length" class="q-py-lg text-center">
        <q-spinner-dots color="primary" size="32px" />
      </div>
      <div v-else-if="!items.length" class="q-py-lg text-center text-grey-6">
        {{ finalProps.emptyMessage || 'No records found' }}
      </div>
      <AqlList
        v-else
        :items="finalProps.items"
        :bordered="false"
        :item-bordered="false"
        :clickable="false"
        item-class="q-pa-none"
        :class="['card-list', { 'q-gutter-sm': finalProps.layout !== 'grid' }]"
        :style="finalProps.listStyle"
      >
        <template #item="{ item: row }">
          <div class="record-card-wrap full-width">
            <component
              :is="resolvedRecord.component"
              :row="row"
              :resolve-primary-text="finalProps.resolvePrimaryText"
              :resolve-secondary-text="finalProps.resolveSecondaryText"
              :record-config="resolvedRecord.config"
              @open-detail="$emit('navigate-to-view', $event)"
            />
            <div v-if="childCountMap[row.Code] && !finalProps.noChildCounts" class="record-children">
              <q-badge
                v-for="(count, childName) in childCountMap[row.Code]"
                :key="childName"
                outline
                color="primary"
                class="q-mr-xs"
              >
                {{ count }} {{ childName }}
              </q-badge>
            </div>
          </div>
        </template>
      </AqlList>
    </q-card-section>
  </q-card>
</template>
```

##### Replace resolver setup (Lines 102-142) in `<script setup>` with:
```javascript
const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  resolvedFields: { type: Array, default: () => [] },
  childCountMap: { type: Object, default: () => ({}) },
  resourceSlug: { type: String, required: true },
  customUIName: { type: String, required: true },
  recordsConfig: { type: Object, default: () => ({}) },
  page: { type: String, default: 'List' }
})

// Check for local overrides using useSectionResolver
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Records',
  page: props.page
})

// Sub-components resolve themselves. Statically import defaults
import RecordComponent from 'components/_common/Content/RecordsRecord.vue'
// We resolve sub-record components if needed or render them statically
const resolvedRecord = computed(() => {
  return { component: RecordComponent, config: activeConfig.value.record || {} }
})

// Package prepared props
const preparedProps = computed(() => ({
  items: props.items,
  loading: props.loading,
  resolvedFields: props.resolvedFields,
  childCountMap: props.childCountMap,
  resourceSlug: props.resourceSlug,
  customUIName: props.customUIName,
  recordsConfig: props.recordsConfig,
  flat: activeConfig.value.flat,
  bordered: activeConfig.value.bordered,
  class: activeConfig.value.class,
  emptyMessage: activeConfig.value.emptyMessage,
  layout: activeConfig.value.layout,
  listStyle: listStyle.value,
  noChildCounts: activeConfig.value.noChildCounts,
  resolvePrimaryText,
  resolveSecondaryText
}))

// Apply JS transform override
const finalProps = computed(() => propModifier.value(preparedProps.value))
```

---

## Verification Plan

### Automated Tests
- Build verification: Run `npm run build` from root directory to verify there are no compilation or bundle errors.

### Manual Verification
1. Open the Master Product index page (should render using the default Records and Toolbar setup).
2. Create a test JS modifier under `src/components/Masters/Products/Index/Toolbar.js` that changes standard labels. Ensure it loads and changes the labels.
3. Create a test template-only component under `src/components/Masters/Products/Index/Toolbar.vue` with a simple placeholder template. Verify it overrides the toolbar template completely.
4. Verify navigation flows (index -> add -> save, edit -> save) to ensure all route and event emits from Page.vue function as expected.
