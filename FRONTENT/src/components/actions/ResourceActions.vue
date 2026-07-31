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
 * Unified resource-action FAB cluster (evolution of the former `CrudActions.vue`).
 *
 * One bottom-right sticky cluster per page, sourcing its items from BOTH:
 *   - resource permissions — Add (`canWrite`) and Edit (`canUpdate` + record),
 *   - `resourceConfig.additionalActions` (APP.Resources `AdditionalActions` JSON) —
 *     workflow/navigate actions, permission-gated (`can<Action>` explicit-deny)
 *     and `visibleWhen`-filtered via `isActionVisible`, record context required.
 *
 * Layout: a single item renders as one standalone FAB; multiple items collapse
 * into one expandable `ResourceActionsFab` menu.
 *
 * Every item is mounted through `<Action>` under a per-item action name —
 * `ResourceActionAdd`, `ResourceActionEdit`, `ResourceAction<Name>` (e.g.
 * `ResourceActionApprove`) — with `ResourceActionItem` as the fallback base, so
 * each item's icon/color/label/visibility/click is overridable at all 10 `_ui/`
 * tiers as `resourceaction<name>.(vue|js)`. The menu trigger resolves the same
 * way as `ResourceActionsFab`.
 *
 * Dispatch: CRUD items navigate via `useResourceNav`; workflow `mutate` items
 * open the page-level `ActionDialog` through `pageState.meta.actionDialog`
 * (mounted once in `Page.vue`); `navigate` items route to their configured
 * record/resource page. A JS modifier may replace any item's behaviour by
 * returning a `handler` prop (see `ResourceActionItem.vue`).
 *
 * Entrance animation (`.aql-resource-action-container`) lives in
 * `src/css/custom.scss` on an inner wrapper — never on `q-page-sticky` itself,
 * since a transform on a `position: fixed` ancestor becomes its containing
 * block and breaks FAB positioning. No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import { toPascalCase } from 'src/utils/appHelpers'
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
const pageState      = inject('pageState', null)
const nav = useResourceNav()
const { code: routeCode } = useRouteConfig()

const pageKey = computed(() => (props.page || '').toLowerCase())
// Form pages are owned by the FormActions sticky bar. PageAction already gates
// this, but a direct <Action action="ResourceActions" /> mount must obey too.
const isFormPage = computed(() => ['add', 'edit', 'action'].includes(pageKey.value))

const permissions = computed(() => resourceConfig?.permissions?.value || {})
const record = computed(() => resourceRecord?.record?.value || null)
const additionalActions = computed(() => resourceConfig?.additionalActions?.value || [])

// ── Workflow/navigate actions from AdditionalActions JSON ─────────────────────
// Record context required (they act on a record, so they belong to View-style
// pages); permission gate is the explicit `can<Action>` flag when the backend
// defines one; `visibleWhen` conditions evaluate against the live record.
const visibleAdditional = computed(() => {
  if (isFormPage.value || !record.value) return []
  return additionalActions.value.filter((act) => {
    if (permissions.value[`can${act.action}`] === false) return false
    return isActionVisible(act, record.value)
  })
})

// ── Unified entry list ────────────────────────────────────────────────────────
//
// Each entry's `props` are built here, not in the template: a `v-bind="fn(entry)"`
// call would allocate a fresh props object on every render of the cluster, giving
// each child <Action> a new object identity (and a new reactive dependency set) each
// time. Built inside the computed, they are re-created only when the entry list or
// the resolver context actually changes.
const entries = computed(() => {
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
  visibleAdditional.value.forEach((act) => {
    list.push({
      key: `additional:${act.action}`,
      actionName: `ResourceAction${toPascalCase(act.action)}`,
      props: {
        ...ctx,
        icon: act.icon || 'bolt',
        color: act.color || 'primary',
        label: act.label || act.action,
        tooltip: act.label || act.action
      },
      run: () => runAdditional(act)
    })
  })
  return list
})

function run (entry) {
  entry.run()
}

function runAdditional (act) {
  if (act.kind === 'navigate') {
    const target = act.navigate?.target || 'record-page'
    const params = {
      scope: act.navigate?.scope || resourceConfig?.scope?.value,
      resourceSlug: act.navigate?.resourceSlug || resourceConfig?.resourceSlug?.value,
      pageSlug: act.navigate?.pageSlug || ''
    }
    if (target === 'record-page') {
      params.code = act.navigate?.code || record.value?.Code || routeCode.value
    }
    nav.goTo(target, params)
    return
  }
  // Mutate/workflow action → the page-level ActionDialog mounted once in
  // Page.vue, driven through pageState so a PageAction override can't swallow it.
  if (pageState) {
    pageState.meta.actionDialog.actionConfig = act
    pageState.meta.actionDialog.show = true
  }
}

// ── Resolver context: explicit props win, injected resourceConfig is fallback ──
const resolverContext = computed(() => ({
  page:     props.page,
  scope:    props.scope    ?? resourceConfig?.scope?.value        ?? 'master',
  resource: props.resource ?? resourceConfig?.resourceSlug?.value ?? '',
  uiName:   props.uiName   ?? resourceConfig?.customUIName?.value ?? 'AQL'
}))

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
