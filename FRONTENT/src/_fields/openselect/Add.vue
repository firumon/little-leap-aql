<template>
  <q-select
    v-model="model"
    outlined
    emit-value
    map-options
    v-bind="selectBindings"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey-6">No matching options</q-item-section>
      </q-item>
    </template>

    <template #after-options>
      <q-separator />
      <q-item
        v-close-popup
        clickable
        @click="openPrompt"
      >
        <q-item-section avatar>
          <q-icon name="edit_note" color="primary" />
        </q-item-section>
        <q-item-section class="text-primary">{{ freeTextLabel }}</q-item-section>
      </q-item>
    </template>
  </q-select>

  <q-dialog
    v-model="prompting"
    @hide="draft = ''"
  >
    <q-card style="min-width: 300px">
      <q-card-section class="text-subtitle1">{{ freeTextLabel }}</q-card-section>
      <q-card-section class="q-pt-none">
        <q-input
          ref="draftInput"
          v-model="draft"
          outlined
          autofocus
          :label="config.label || header"
          :error="!!draftError"
          :error-message="draftError"
          @keyup.enter="commitDraft"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          v-close-popup
          flat
          label="Cancel"
        />
        <q-btn
          unelevated
          color="primary"
          label="Add"
          @click="commitDraft"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'FieldOpenselectAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

// Same threshold as `select`: below it a dropdown is faster to scan than to type
// into, and `use-input` raises the soft keyboard over the list being picked from.
const SEARCH_THRESHOLD = 15

const freeTextLabel = computed(() => props.config?.freeTextLabel || 'Enter a new value')

const schemaOptions = computed(() => (Array.isArray(props.config?.options) ? props.config.options : []))

// Values typed through the prompt this session, plus whatever the record already
// holds. A stored value outside the schema list must still show as selected.
const addedOptions = ref([])

const valueOf = (option) => (option != null && typeof option === 'object' ? option.value : option)
const labelOf = (option) => {
  if (option == null) return ''
  if (typeof option === 'object') return String(option.label ?? option.value ?? '')
  return String(option)
}

const baseOptions = computed(() => {
  const merged = [...schemaOptions.value]
  const seen = new Set(merged.map((option) => String(valueOf(option))))

  const push = (value) => {
    const key = String(value ?? '').trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push({ label: key, value: key })
  }

  addedOptions.value.forEach(push)
  push(model.value)
  return merged
})

const enableSearch = computed(() => {
  if (typeof props.config?.useInput === 'boolean') return props.config.useInput
  return baseOptions.value.length >= SEARCH_THRESHOLD
})

const filteredOptions = ref(baseOptions.value)

watch(baseOptions, (next) => { filteredOptions.value = next })

// `config` first, then the keys this component owns, so the locally computed
// options are always the last word over whatever a caller passed.
const selectBindings = computed(() => ({
  ...props.config,
  options: filteredOptions.value,
  ...(enableSearch.value
    ? { useInput: true, inputDebounce: 200, onFilter }
    : { useInput: false })
}))

function onFilter (needle, update) {
  update(() => {
    const term = String(needle || '').trim().toLowerCase()
    filteredOptions.value = term
      ? baseOptions.value.filter((option) => labelOf(option).toLowerCase().includes(term))
      : baseOptions.value
  })
}

const prompting = ref(false)
const draft = ref('')
const draftError = ref('')

function openPrompt () {
  draft.value = ''
  draftError.value = ''
  prompting.value = true
}

function commitDraft () {
  const value = String(draft.value || '').trim()
  if (!value) {
    draftError.value = 'Type a value first.'
    return
  }

  const clash = baseOptions.value.find((option) => labelOf(option).toLowerCase() === value.toLowerCase())
  if (clash) {
    model.value = valueOf(clash)
    prompting.value = false
    return
  }

  addedOptions.value = [...addedOptions.value, value]
  model.value = value
  prompting.value = false
}
</script>
