<template>
  <q-page-sticky position="bottom-right" :offset="[16, 22]" class="fab-sticky" v-if="sectionsReady">
    <q-btn
      round
      unelevated
      color="primary"
      class="fab-btn"
      @click="navigateToAdd"
    >
      <!-- Resolve FAB Icon recursively -->
      <component :is="sections.AddFABIcon" />
      
      <!-- Resolve FAB Tooltip recursively -->
      <component :is="sections.AddFABTooltip" />
    </q-btn>
  </q-page-sticky>
</template>

<script setup>
import { inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'AddFAB' })

const nav = useResourceNav()
const { resourceSlug, scope } = inject('resourceConfig')

// Resolve AddFAB sub-sections recursively
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'AddFAB',
  sectionDefs: {
    AddFABIcon: { section: 'AddFABIcon', default: 'src/components/_common/AddFAB/AddFABIcon.vue' },
    AddFABTooltip: { section: 'AddFABTooltip', default: 'src/components/_common/AddFAB/AddFABTooltip.vue' }
  }
})

function navigateToAdd() {
  nav.goTo('add')
}
</script>

<style scoped>
.fab-btn {
  width: 56px;
  height: 56px;
  box-shadow: 0 8px 24px rgba(15, 43, 74, 0.3);
  background: linear-gradient(145deg, var(--q-primary), var(--q-primary-dark, #1565c0));
  transition: transform 180ms ease;
}
.fab-btn:active {
  transform: scale(0.95);
}
.fab-sticky {
  z-index: 30;
}
</style>
