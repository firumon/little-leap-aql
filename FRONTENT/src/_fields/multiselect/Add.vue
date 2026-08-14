<template>
  <q-select
    v-model="model"
    outlined
    multiple
    use-chips
    emit-value
    map-options
    v-bind="selectBindings"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey-6">No matching options</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
/**
 * Multi-value select — the array-valued sibling of `_fields/select/`.
 *
 * Deliberately a separate TYPE rather than a `multiple` flag on `select`: the two
 * disagree on the shape of `modelValue` (a scalar vs an array), and every consumer
 * — `v-model` targets, `View.vue`'s label resolution, default seeding — has to
 * branch on that shape. A distinct folder lets each stay single-shaped.
 *
 * Mirrors `select`'s structure exactly (same bindings contract, same search
 * threshold, same local filter buffer) so the two behave identically apart from
 * cardinality. See AQL_CUSTOM_UI_GUIDE §2.3.
 */
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'FieldMultiselectAdd', inheritAttrs: false })

// An ARRAY by default, never null: `q-select` in `multiple` mode pushes onto the
// bound value, so a null model would throw on the first selection.
const model = defineModel({ default: () => [] })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

// Below this many options a dropdown is faster to scan than to type into, and
// `use-input` costs real usability on the mobile-first target: it focuses a text
// input on open, which raises the soft keyboard over the very list being picked
// from. At or above it, scrolling wins and the search box earns its place.
//
// Lower than `select`'s threshold on purpose — a multi-select is worked through
// repeatedly rather than picked from once, so search pays for itself sooner.
const SEARCH_THRESHOLD = 10

const baseOptions = computed(() => (Array.isArray(props.config?.options) ? props.config.options : []))

// An explicit `config.useInput` always wins — some pickers want search on a short
// list (or suppressed on a long one). Otherwise the option count decides.
const enableSearch = computed(() => {
  if (typeof props.config?.useInput === 'boolean') return props.config.useInput
  return baseOptions.value.length >= SEARCH_THRESHOLD
})

// One merged binding object — Vue's template compiler rejects two `v-bind="…"`
// objects on the same element ("Duplicate attribute"). Order is the contract:
// `config` first, then the keys this component owns, so the locally computed
// `options` / `useInput` are always the last word over whatever a caller passed.
// `inputDebounce` and the `filter` listener are attached ONLY while search is on.
//
// `clearable` defaults on: with several values selected, "start over" is otherwise
// N taps. A caller may still turn it off through `config`.
const selectBindings = computed(() => ({
  clearable: true,
  ...props.config,
  options: filteredOptions.value,
  ...(enableSearch.value
    // `fillInput` is deliberately absent — it belongs to single-value selects and
    // would write the last picked label back into a search box that is shared by
    // every subsequent pick.
    ? { useInput: true, inputDebounce: 200, onFilter }
    : { useInput: false })
}))

// Local filtering buffer. Re-seeded whenever the upstream option list changes
// (relation pickers rebuild theirs as the target resource syncs).
const filteredOptions = ref(baseOptions.value)

watch(baseOptions, (next) => { filteredOptions.value = next })

function optionLabel (option) {
  if (option == null) return ''
  if (typeof option === 'object') return String(option.label ?? option.value ?? '')
  return String(option)
}

function onFilter (needle, update) {
  update(() => {
    const term = String(needle || '').trim().toLowerCase()
    filteredOptions.value = term
      ? baseOptions.value.filter((option) => optionLabel(option).toLowerCase().includes(term))
      : baseOptions.value
  })
}
</script>
