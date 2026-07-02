<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    v-model="searchTerm"
  />

  <div v-else class="search-input-container">
    <q-input
      v-model="searchTerm"
      v-bind="$attrs"
      :outlined="finalProps.outlined"
      :debounce="finalProps.debounce"
      :placeholder="finalProps.placeholder"
      :label="finalProps.label || undefined"
      class="search-input"
    >
      <template #prepend v-if="finalProps.icon">
        <q-icon :name="finalProps.icon" :color="finalProps.iconColor" />
      </template>

      <template #append v-if="finalProps.clearable && searchTerm">
        <q-icon
          :name="finalProps.clearIcon"
          :color="finalProps.clearIconColor"
          class="cursor-pointer"
          @click="searchTerm = ''"
        />
      </template>
    </q-input>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'SearchInput', inheritAttrs: false })

const props = defineProps({
  page: { type: String, default: 'Index' },
  outlined: { type: Boolean, default: true },
  debounce: { type: [Number, String], default: 180 },
  placeholder: { type: String, default: 'Search code, name, or any field...' },
  icon: { type: String, default: 'search' },
  iconColor: { type: String, default: 'grey-6' },
  clearable: { type: Boolean, default: true },
  clearIcon: { type: String, default: 'cancel' },
  clearIconColor: { type: String, default: 'grey-5' },
  label: { type: String, default: '' }
})

const { searchTerm } = inject('resourceRecord', { searchTerm: ref('') })

const preparedProps = computed(() => ({
  searchTerm: searchTerm.value,
  outlined: props.outlined,
  debounce: props.debounce,
  placeholder: props.placeholder,
  icon: props.icon,
  iconColor: props.iconColor,
  clearable: props.clearable,
  clearIcon: props.clearIcon,
  clearIconColor: props.clearIconColor,
  label: props.label
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'SearchInput',
  page: props.page,
  preparedProps
})
</script>
