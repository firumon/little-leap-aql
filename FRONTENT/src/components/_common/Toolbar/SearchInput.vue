<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-slot="{ value }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    v-model="searchTerm"
  />

  <div v-else class="search-input-container">
    <q-input
      v-model="searchTerm"
      outlined
      debounce="180"
      :placeholder="placeholderText"
      class="search-input"
    >
      <template #prepend>
        <SearchInputIcon :page="page" />
      </template>

      <template #append v-if="searchTerm">
        <SearchInputClear :page="page" @clear="searchTerm = ''" />
      </template>

      <template #label>
        <SearchInputLabel :page="page" />
      </template>
    </q-input>

    <!-- Hidden element to extract text content for placeholder from template -->
    <div ref="hiddenPlaceholderRef" class="hidden">
      <SearchInputPlaceholder :page="page" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject, computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

import SearchInputIcon from 'components/_common/Toolbar/SearchInput/SearchInputIcon.vue'
import SearchInputClear from 'components/_common/Toolbar/SearchInput/SearchInputClear.vue'
import SearchInputPlaceholder from 'components/_common/Toolbar/SearchInput/SearchInputPlaceholder.vue'
import SearchInputLabel from 'components/_common/Toolbar/SearchInput/SearchInputLabel.vue'

defineOptions({ name: 'SearchInput' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resourceSlug, scope } = inject('resourceConfig')
const { searchTerm } = inject('resourceRecord', { searchTerm: ref('') })

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'SearchInput',
  page: props.page
})

const preparedProps = computed(() => ({
  searchTerm: searchTerm.value
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))

const hiddenPlaceholderRef = ref(null)
const placeholderText = ref('Search code, name, or any field...')

// Check placeholder text reactively
watch(
  () => [searchTerm.value, resolvedComponent.value],
  () => {
    nextTick(() => {
      if (hiddenPlaceholderRef.value) {
        placeholderText.value = hiddenPlaceholderRef.value.textContent?.trim() || 'Search code, name, or any field...'
      }
    })
  },
  { immediate: true }
)
</script>
