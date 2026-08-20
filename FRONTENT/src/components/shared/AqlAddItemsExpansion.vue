<template>
  <q-expansion-item
    v-if="items.length"
    :icon="icon"
    :label="label"
    :caption="captionText"
    :header-class="headerClass"
    class="rounded-borders"
    :class="cardClass"
  >
    <!-- The filter. Shown only once the list is long enough to need one: on four items a
         search box is another thing to read past, and on forty it is the only way in. -->
    <q-card-section v-if="items.length >= searchThreshold" class="q-pb-none">
      <q-input
        :model-value="search"
        :label="searchLabel"
        outlined
        clearable
        debounce="150"
        @update:model-value="(value) => (search = value || '')"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </q-card-section>

    <!-- `relative-position` is load-bearing, not decoration. `.aql-list-item-leave-active`
         takes a leaving row OUT OF FLOW with `position: absolute` (css/transitions.scss), so
         without a positioned ancestor here the row flies off against the page instead of
         sliding out of the list — which reads as no transition at all. `abstract/List.vue`
         carries the same class on its own `q-list` for the same reason. -->
    <q-list separator class="relative-position">
      <!-- A TransitionGroup, so a row LEAVES rather than vanishing. In a drawer the user is
           tapping repeatedly, an instant disappearance reads as a mis-tap on the row below;
           a short slide out confirms which item was taken. -->
      <TransitionGroup name="aql-list-item">
        <!-- `q-py-sm` on every row: the default `q-item` density packs the add buttons close
             enough that a thumb catches the neighbouring one. -->
        <q-item v-for="option in visible" :key="option.value" class="q-py-sm">
          <q-item-section class="aql-flex-wrap-text">
            <q-item-label>{{ option.primary || option.label }}</q-item-label>
            <q-item-label v-if="option.secondary" caption>{{ option.secondary }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <slot name="row" :option="option" />
          </q-item-section>
        </q-item>
      </TransitionGroup>
    </q-list>

    <q-card-section v-if="!visible.length" class="text-center text-caption text-grey-7 q-py-md">
      Nothing here matches “{{ search }}”.
    </q-card-section>
  </q-expansion-item>
</template>

<script setup>
/**
 * The shared "add other items" drawer.
 *
 * Four wizards grew their own copy of this control — restock lines, extra returns, invoice
 * lines — and each copy drifted on padding, on whether it could be searched, and on whether
 * an added row left cleanly. One component, one behaviour (ARCHITECTURE RULES §8: check the
 * registry and reuse before implementing a list by hand).
 *
 * It owns only the SHELL: the expansion, the filter, the row rhythm and the leave
 * transition. What sits at the end of a row — a quantity stepper, a price box, an add
 * button — differs genuinely between callers and comes in through the `row` slot, which
 * receives the option. The component never mutates the list; the caller removes an item
 * from `items` and the transition plays it out.
 *
 * `items` are `{ value, label | primary, secondary? }`. Filtering matches across all three
 * text fields, so an SKU code, a product name and a variant all find the same row.
 *
 * Lives in `components/shared/` — stateless and universally reusable — and carries no
 * `<style>` block; the row-gap classes are Quasar's and the transition is the app's own
 * `aql-list-item` (css/transitions.scss).
 */
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'AqlAddItemsExpansion', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] },
  icon: { type: String, default: 'add_circle_outline' },
  label: { type: String, default: 'Add other items' },
  // Omitted by default so the component states the count itself; pass one to override.
  caption: { type: String, default: '' },
  headerClass: { type: String, default: 'text-primary text-weight-medium' },
  cardClass: { type: [String, Array, Object], default: '' },
  searchLabel: { type: String, default: 'Search items' },
  // Below this many rows the whole list is on screen already and a filter earns nothing.
  searchThreshold: { type: Number, default: 6 }
})

const search = ref('')

// A drawer that empties as items are added must not keep filtering by a term that now
// matches nothing left — the user would see "no matches" for a list they just emptied.
watch(() => props.items.length, (count) => { if (!count) search.value = '' })

const captionText = computed(() =>
  props.caption || `${props.items.length} more item(s) available`)

const visible = computed(() => {
  const term = String(search.value || '').trim().toLowerCase()
  if (!term) return props.items
  return props.items.filter((option) => [option.label, option.primary, option.secondary, option.value]
    .some((field) => String(field || '').toLowerCase().includes(term)))
})
</script>
