<template>
  <slot :actions="actions" :open="run">
    <!-- ── inline: a row of icon buttons ─────────────────────────────────── -->
    <div v-if="actions.length && mode === 'inline'" class="row items-center no-wrap q-gutter-xs">
      <q-btn
        v-for="action in actions"
        :key="action.action"
        flat
        round
        :dense="dense"
        :size="size"
        :icon="action.icon || 'bolt'"
        :color="action.color || 'primary'"
        @click.stop="run(action)"
      >
        <q-tooltip>{{ action.label || action.action }}</q-tooltip>
      </q-btn>
    </div>

    <!-- ── menu: one overflow button ─────────────────────────────────────── -->
    <q-btn
      v-else-if="actions.length && mode === 'menu'"
      flat
      round
      :dense="dense"
      :size="size"
      icon="more_vert"
      @click.stop
    >
      <q-menu auto-close>
        <q-list style="min-width: 160px">
          <q-item v-for="action in actions" :key="action.action" clickable @click="run(action)">
            <q-item-section avatar>
              <q-icon :name="action.icon || 'bolt'" :color="action.color || 'primary'" />
            </q-item-section>
            <q-item-section>{{ action.label || action.action }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- ── fab: expandable cluster ───────────────────────────────────────── -->
    <q-fab
      v-else-if="actions.length && mode === 'fab'"
      push
      glossy
      icon="more_vert"
      direction="up"
      color="primary"
      :disable="actions.length === 0"
    >
      <q-fab-action
        v-for="action in actions"
        :key="action.action"
        push
        glossy
        external-label
        label-position="left"
        :icon="action.icon || 'bolt'"
        :color="action.color || 'primary'"
        :label="action.label || action.action"
        @click="run(action)"
      />
    </q-fab>
  </slot>
</template>

<script setup>
/**
 * Embeddable AdditionalActions trigger cluster.
 *
 * Drop it wherever a record is on screen — a list item, a detail header, a
 * toolbar — and it renders that record's currently-available workflow actions.
 *
 * This component owns NO logic. Permission gating, `visibleWhen`, navigate-vs-
 * mutate dispatch, input collection and submission all live in
 * `useAdditionalActions`; this only renders what that composable returns and
 * hands clicks straight back to it.
 *
 * Resolution is by resource NAME, not by route, so this works outside a resource
 * page entirely. Gating is per record, so two rows in different states correctly
 * offer different buttons.
 *
 * It renders TRIGGERS ONLY. The dialog is a single shared instance mounted in
 * `MainLayout.vue` — fifty list rows must not mean fifty mounted dialogs.
 *
 * The default slot exposes `{ actions, open }` for a caller who wants their own
 * buttons without re-deriving the gating:
 *
 *   <AdditionalActionsButtons resource="OutletVisits" :record="visit">
 *     <template #default="{ actions, open }">
 *       <q-btn v-for="a in actions" :key="a.action" :label="a.label" @click="open(a)" />
 *     </template>
 *   </AdditionalActionsButtons>
 */
import { computed } from 'vue'
import { useAdditionalActions } from 'src/composables/resources/useAdditionalActions'

defineOptions({ name: 'AppAdditionalActionsButtons', inheritAttrs: false })

const props = defineProps({
  resource: { type: String, required: true },
  record:   { type: Object, required: true },

  mode:  { type: String, default: 'inline', validator: (v) => ['inline', 'menu', 'fab'].includes(v) },
  // Whitelist / blacklist by action key. A list row usually wants one or two
  // actions where a detail page wants all of them, and both should read the
  // same config rather than maintaining separate lists.
  only:    { type: Array, default: null },
  exclude: { type: Array, default: null },

  dense: { type: Boolean, default: true },
  size:  { type: String, default: 'md' }
})

// Resolved once per instance: `useResourceConfig` takes a plain name, not a ref.
// Each record renders its own instance, so a component never needs to switch
// resources mid-life.
const { actionsFor, runAction } = useAdditionalActions(props.resource)

const actions = computed(() => actionsFor(props.record, { only: props.only, exclude: props.exclude }))

// Dispatch belongs to the composable — navigate vs mutate is its decision, not
// this component's.
function run (action) {
  runAction(action, props.record)
}
</script>
