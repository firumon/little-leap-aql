<template>
  <q-card flat bordered class="search-card" v-if="sectionsReady">
    <q-card-section class="q-pa-sm q-pa-md">
      <q-input
        :model-value="searchTerm"
        outlined
        dense
        debounce="180"
        placeholder="Search code, name, or any field..."
        class="search-input"
        @update:model-value="$emit('update:search-term', $event)"
      >
        <template #prepend>
          <component :is="sections.SearchInputIcon" />
        </template>

        <template #append v-if="searchTerm">
          <component :is="sections.SearchInputClear" @clear="$emit('update:search-term', '')" />
        </template>
      </q-input>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SearchInput' })

defineProps({
  searchTerm: { type: String, default: '' }
})

defineEmits(['update:search-term'])

const { resourceSlug, scope } = inject('resourceConfig')

// Resolve SearchInput sub-components recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'SearchInput',
  sectionDefs: {
    SearchInputIcon: { section: 'SearchInputIcon', default: 'src/components/_common/SearchInput/SearchInputIcon.vue' },
    SearchInputClear: { section: 'SearchInputClear', default: 'src/components/_common/SearchInput/SearchInputClear.vue' }
  }
})
</script>

<style scoped>
.search-card {
  border-radius: 16px;
  border-color: var(--aql-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.search-input :deep(.q-field__control) {
  border-radius: 12px;
  background: #fff;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
