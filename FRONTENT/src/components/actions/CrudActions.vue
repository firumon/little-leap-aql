<template>
  <!-- 1. Single Add FAB (Index/Resource list pages) -->
  <q-page-sticky v-if="showAdd && !showEdit" position="bottom-right" :offset="[18, 18]">
    <div class="aql-crud-action-container">
      <component :is="resolvedAddFab" v-bind="addFabProps" @click="navigateToAdd" />
    </div>
  </q-page-sticky>

  <!-- 2. Single Edit FAB (View page with Update-only permission) -->
  <q-page-sticky v-else-if="showEdit && !showAdd" position="bottom-right" :offset="[18, 18]">
    <div class="aql-crud-action-container">
      <component :is="resolvedEditFab" v-bind="editFabProps" @click="navigateToEdit" />
    </div>
  </q-page-sticky>

  <!-- 3. Expandable FAB Menu (View page with both Update & Write permissions) -->
  <q-page-sticky v-else-if="showEdit && showAdd" position="bottom-right" :offset="[18, 18]">
    <div class="aql-crud-action-container">
      <component :is="resolvedCrudActionsFab" v-bind="crudActionsFabProps">
        <template #AddFab>
          <component :is="resolvedAddFab" v-bind="addFabProps" as-fab-action @click="navigateToAdd" />
        </template>
        <template #EditFab>
          <component :is="resolvedEditFab" v-bind="editFabProps" as-fab-action @click="navigateToEdit" />
        </template>
      </component>
    </div>
  </q-page-sticky>
</template>

<script setup>
/**
 * CRUD floating action buttons (Add / Edit / expandable menu).
 *
 * Lives in the Action subsystem (`components/actions/`) and is mounted by
 * `PageAction.vue` through `useActionResolver`, so a tenant can replace or modify
 * it at any of the 10 `_ui/` tiers as `CrudActions.(vue|js)`.
 *
 * Its individual FABs (`AddFab`, `EditFab`, `CrudActionsFab`) live alongside it in
 * `components/actions/` and resolve through `useActionResolver`. The folder is the
 * resolution contract (ARCHITECTURE RULES §8), so an action container's children
 * must not be resolved as sections. The 10-tier `_ui/` override paths are identical
 * either way — only the base-component lookup moved from `components/sections/` to
 * `components/actions/`.
 *
 * Entrance animation (750ms-delayed `bounceIn` on `.aql-crud-action-container`)
 * lives in `src/css/custom.scss` — see ARCHITECTURE RULES §7.
 */
import { computed, inject, useAttrs } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import AddFab from './AddFab.vue'
import EditFab from './EditFab.vue'
import CrudActionsFab from './CrudActionsFab.vue'

defineOptions({ name: 'ActionsCrudActions', inheritAttrs: false })

const props = defineProps({
  page:     { type: String, default: 'index' },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null }
})

// Whatever CrudActions received from its parent beyond its own declared props (e.g. a
// CrudActions-level JS modifier's color/icon/tooltip) cascades down into every
// sub-section resolver below, so an override at any level keeps flowing through.
const attrs = useAttrs()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const nav = useResourceNav()

const pageKey = computed(() => (props.page || '').toLowerCase())
const permissions = computed(() => resourceConfig?.permissions?.value || {})
const hasRecord = computed(() => !!resourceRecord?.record?.value)

// Form pages (add/edit) — the FormActions sticky bar owns save/cancel, no floating FABs.
const isFormPage = computed(() => pageKey.value === 'add' || pageKey.value === 'edit')

const showAdd = computed(() => !isFormPage.value && !!permissions.value.canWrite)
const showEdit = computed(() => !isFormPage.value && hasRecord.value && !!permissions.value.canUpdate)

function navigateToAdd() { nav.goTo('add') }
function navigateToEdit() { nav.goTo('edit') }

// ── DRY resolver-props base: explicit props win, resourceConfig is only a fallback ──
const availableProps = computed(() => ({
  page:     props.page,
  scope:    props.scope    ?? resourceConfig?.scope?.value        ?? 'master',
  resource: props.resource ?? resourceConfig?.resourceSlug?.value ?? '',
  uiName:   props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL'
}))

// Inherited attrs are spread first so availableProps' own resolved values (which may
// themselves be defaults, not overrides) never clobber a genuine parent-supplied value —
// but action/page/scope/resource/uiName stay authoritative from availableProps below.
function resolverProps(action) {
  return computed(() => ({ ...attrs, action, ...availableProps.value }))
}

const { resolvedComponent: resolvedAddFab, finalProps: addFabProps } =
  useActionResolver(resolverProps('AddFab'), AddFab)

const { resolvedComponent: resolvedEditFab, finalProps: editFabProps } =
  useActionResolver(resolverProps('EditFab'), EditFab)

const { resolvedComponent: resolvedCrudActionsFab, finalProps: crudActionsFabProps } =
  useActionResolver(resolverProps('CrudActionsFab'), CrudActionsFab)
</script>
