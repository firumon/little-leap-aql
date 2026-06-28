<template>
  <div class="search-input-container" v-if="sectionsReady">
    <q-input
      v-model="searchTerm"
      outlined
      debounce="180"
      :placeholder="placeholderText"
      :label="sections.SearchInputLabel !== EmptyComponent ? ' ' : undefined"
      class="search-input"
    >
      <template #prepend v-if="sections.SearchInputIcon">
        <component :is="sections.SearchInputIcon" />
      </template>

      <template #append v-if="searchTerm && sections.SearchInputClear">
        <component :is="sections.SearchInputClear" @clear="searchTerm = ''" />
      </template>

      <template #label v-if="sections.SearchInputLabel && sections.SearchInputLabel !== EmptyComponent">
        <component :is="sections.SearchInputLabel" />
      </template>
    </q-input>

    <!-- Hidden element to extract text content for placeholder from template -->
    <div ref="hiddenPlaceholderRef" class="hidden">
      <component
        :is="sections.SearchInputPlaceholder"
        v-if="sections.SearchInputPlaceholder && sections.SearchInputPlaceholder !== EmptyComponent"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import SearchInputIcon from 'components/_common/Toolbar/SearchInput/SearchInputIcon.vue'
import SearchInputClear from 'components/_common/Toolbar/SearchInput/SearchInputClear.vue'

defineOptions({ name: 'SearchInput' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const { resourceSlug, scope } = inject('resourceConfig')
const { searchTerm } = inject('resourceRecord', { searchTerm: ref('') })

const EmptyComponent = { name: 'SearchInputEmpty', render() { return null } }

// Resolve SearchInput sub-sections at the specified page level
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: props.page,
  sectionDefs: {
    SearchInputIcon: { section: 'SearchInputIcon', default: SearchInputIcon },
    SearchInputClear: { section: 'SearchInputClear', default: SearchInputClear },
    SearchInputPlaceholder: { section: 'SearchInputPlaceholder', default: EmptyComponent },
    SearchInputLabel: { section: 'SearchInputLabel', default: EmptyComponent }
  }
})

const hiddenPlaceholderRef = ref(null)
const placeholderText = ref('')

watch(
  () => [sectionsReady.value, sections.SearchInputPlaceholder],
  ([ready, newComp]) => {
    if (!ready) return

    if (!newComp || newComp === EmptyComponent) {
      placeholderText.value = 'Search code, name, or any field...'
      return
    }
    nextTick(() => {
      if (hiddenPlaceholderRef.value) {
        placeholderText.value = hiddenPlaceholderRef.value.textContent?.trim() || 'Search...'
      }
    })
  },
  { immediate: true }
)
</script>
