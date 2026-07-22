<template>
  <!-- 1. Single Add FAB (Index/Resource list pages) -->
  <q-page-sticky v-if="showAdd && !showEdit" position="bottom-right" :offset="[18, 18]">
    <component :is="resolvedAddFab" v-bind="addFabProps" @click="navigateToAdd" />
  </q-page-sticky>

  <!-- 2. Single Edit FAB (View page with Update-only permission) -->
  <q-page-sticky v-else-if="showEdit && !showAdd" position="bottom-right" :offset="[18, 18]">
    <component :is="resolvedEditFab" v-bind="editFabProps" @click="navigateToEdit" />
  </q-page-sticky>

  <!-- 3. Expandable FAB Menu (View page with both Update & Write permissions) -->
  <q-page-sticky v-else-if="showEdit && showAdd" position="bottom-right" :offset="[18, 18]">
    <component :is="resolvedCrudActionsFab" v-bind="crudActionsFabProps">
      <template #AddFab>
        <component :is="resolvedAddFab" v-bind="addFabProps" as-fab-action @click="navigateToAdd" />
      </template>
      <template #EditFab>
        <component :is="resolvedEditFab" v-bind="editFabProps" as-fab-action @click="navigateToEdit" />
      </template>
    </component>
  </q-page-sticky>
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import AddFab from './AddFab.vue'
import EditFab from './EditFab.vue'
import CrudActionsFab from './CrudActionsFab.vue'

defineOptions({ name: 'SectionsCrudActions', inheritAttrs: false })

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

// Form pages (add/edit) — the FormAction sticky bar owns save/cancel, no floating FABs.
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
// but section/page/scope/resource/uiName stay authoritative from availableProps below.
function resolverProps(section) {
  return computed(() => ({ ...attrs, section, ...availableProps.value }))
}

const { resolvedComponent: resolvedAddFab, finalProps: addFabProps } =
  useSectionResolver(resolverProps('AddFab'), AddFab)

const { resolvedComponent: resolvedEditFab, finalProps: editFabProps } =
  useSectionResolver(resolverProps('EditFab'), EditFab)

const { resolvedComponent: resolvedCrudActionsFab, finalProps: crudActionsFabProps } =
  useSectionResolver(resolverProps('CrudActionsFab'), CrudActionsFab)
</script>
