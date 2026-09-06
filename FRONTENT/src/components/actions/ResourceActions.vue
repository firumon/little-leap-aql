<template>
  <q-page-sticky v-if="entries.length" position="bottom-right" :offset="[18, 18]">
    <div class="aql-resource-action-container">
      <!-- Exactly one action: a single standalone round FAB. -->
      <Action
        v-if="entries.length === 1"
        :action="entries[0].actionName"
        :fallback="ResourceActionItem"
        v-bind="entries[0].props"
        @click="run(entries[0])"
      />

      <!-- Two or more: one expandable menu hosting every action, so resource
           pages never grow multiple competing right-side FABs. -->
      <component v-else :is="resolvedFab" v-bind="fabProps">
        <Action
          v-for="entry in entries"
          :key="entry.key"
          :action="entry.actionName"
          :fallback="ResourceActionItem"
          as-fab-action
          v-bind="entry.props"
          @click="run(entry)"
        />
      </component>
    </div>
  </q-page-sticky>
</template>

<script setup>
/**
 * The one bottom-right FAB cluster on a non-form page.
 *
 * Entries, in this fixed order: CRUD (Add/Edit, permission gated), sheet
 * AdditionalActions from `useAdditionalActions().entriesFor(record)`, then
 * local-only actions found under `_ui/` by `useLocalResourceActions`. A local
 * file named after a CRUD or sheet action is that entry's override, so it is
 * never appended a second time.
 *
 * The workflow half owns no logic here: entries arrive already gated with
 * `run()` bound. Every item mounts through `<Action>` under its own name
 * (`ResourceAction<Name>`) with `ResourceActionItem` as fallback, so each is
 * overridable at all 10 `_ui/` tiers.
 *
 * One item renders as a standalone FAB; two or more collapse into the
 * expandable `ResourceActionsFab` menu.
 *
 * The entrance animation lives on the inner wrapper, never on `q-page-sticky`:
 * a transform on a fixed ancestor becomes its containing block and breaks FAB
 * positioning. No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import { useAdditionalActions } from 'src/composables/resources/useAdditionalActions'
import { useLocalResourceActions } from 'src/composables/resources/useLocalResourceActions'
import Action from 'components/Action.vue'
import ResourceActionItem from './ResourceActionItem.vue'
import ResourceActionsFab from './ResourceActionsFab.vue'

defineOptions({ name: 'ActionsResourceActions', inheritAttrs: false })

const props = defineProps({
  page:     { type: String, default: 'index' },
  scope:    { type: String, default: null },
  resource: { type: String, default: null },
  uiName:   { type: String, default: null }
})

// `inheritAttrs: false` and no useAttrs(): anything this container receives beyond
// its declared props is intentionally NOT cascaded into the items (see `entries`).

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const nav = useResourceNav()
const routeConfig = useRouteConfig()
// No resource name passed: the cluster is page-level, so it follows the route.
const { entriesFor, additionalActions } = useAdditionalActions()

const pageKey = computed(() => (props.page || '').toLowerCase())
// Form pages are owned by the FormActions sticky bar. PageAction already gates
// this, but a direct <Action action="ResourceActions" /> mount must obey too.
//
// The route check is not redundant with `pageKey`: an action route resolves its
// page key to the ACTION NAME (`/_action/approve` → `approve`), so the literal
// 'action' below only ever matches an explicitly passed `page="action"`.
const isFormPage = computed(() =>
  ['add', 'edit', 'action'].includes(pageKey.value) || routeConfig.pageName.value === 'action'
)

const permissions = computed(() => resourceConfig?.permissions?.value || {})
const record = computed(() => resourceRecord?.record?.value || null)

// ── Resolver context: explicit props win, injected resourceConfig is fallback ──
const resolverContext = computed(() => ({
  page:     props.page,
  scope:    props.scope    ?? resourceConfig?.scope?.value        ?? 'master',
  resource: props.resource ?? resourceConfig?.resourceSlug?.value ?? '',
  uiName:   props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL'
}))

// ── Unified entry list ────────────────────────────────────────────────────────
//
// Each entry's `props` are built here, not in the template: a `v-bind="fn(entry)"`
// call would allocate a fresh props object on every render of the cluster, giving
// each child <Action> a new object identity (and a new reactive dependency set) each
// time. Built inside the computed, they are re-created only when the entry list or
// the resolver context actually changes.
const sourcedEntries = computed(() => {
  const ctx = resolverContext.value
  const list = []
  if (!isFormPage.value && permissions.value.canWrite) {
    list.push({
      key: 'add',
      actionName: 'ResourceActionAdd',
      props: { ...ctx, icon: 'add', color: 'primary', label: 'Add New', tooltip: 'Add New' },
      run: () => nav.goTo('add')
    })
  }
  if (!isFormPage.value && record.value && permissions.value.canUpdate) {
    list.push({
      key: 'edit',
      actionName: 'ResourceActionEdit',
      props: { ...ctx, icon: 'edit', color: 'primary', label: 'Edit', tooltip: 'Edit' },
      run: () => nav.goTo('edit')
    })
  }

  // Workflow items — already permission-gated and `visibleWhen`-filtered by the
  // composable, with `run()` bound. Only the resolver context is merged in here;
  // this component makes no decision about which actions are eligible. A null record
  // is passed through on purpose: the composable answers with the resource-level
  // actions instead, which is what an Index page's cluster offers.
  if (!isFormPage.value) {
    for (const entry of entriesFor(record.value)) {
      list.push({
        key: entry.key,
        actionName: entry.actionName,
        props: { ...ctx, ...entry.props },
        run: entry.run
      })
    }
  }

  return list
})

// Names owned by CRUD or by the sheet. A local file under one of these is that
// item's override, not a new action, so it must not be appended again.
//
// Every DECLARED sheet action counts, not just the ones eligible right now: a
// local file for an action the record has gated off must stay hidden with it.
const takenActionNames = computed(() => {
  const names = new Set(['resourceactionadd', 'resourceactionedit'])
  for (const entry of sourcedEntries.value) names.add(entry.actionName.toLowerCase())
  for (const action of additionalActions.value || []) {
    const name = String(action?.action ?? '').trim()
    if (name) names.add(`resourceaction${name}`.toLowerCase())
  }
  return names
})

const { localEntries } = useLocalResourceActions(resolverContext, takenActionNames)

// Order is fixed: CRUD, then sheet AdditionalActions, then local-only actions.
const entries = computed(() => {
  if (isFormPage.value) return []
  const ctx = resolverContext.value
  return [
    ...sourcedEntries.value,
    ...localEntries.value.map((entry) => ({
      key: entry.key,
      actionName: entry.actionName,
      props: { ...ctx, ...entry.props },
      run: entry.run
    }))
  ]
})

function run (entry) {
  entry.run()
}

// Item props carry explicit lookup context + presentation only (see `entries`).
// `...attrs` is deliberately never spread into them: it carries whatever PageAction
// inherited from pageProps, and fanning that across every item's <Action>
// placeholder both let unrelated page keys hijack an item's appearance and
// multiplied each item's reactive dependency set — the fan-out behind `RangeError:
// Maximum call stack size exceeded at removeSub`. Items read record/config context
// from the injected refs instead, so nothing is lost.

const { resolvedComponent: resolvedFab, finalProps: fabProps } =
  useActionResolver(
    computed(() => ({ action: 'ResourceActionsFab', ...resolverContext.value })),
    ResourceActionsFab
  )
</script>
