<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <q-page-sticky v-else position="bottom-right" :offset="[16, 22]" class="fab-sticky">
    <q-btn
      round
      unelevated
      color="primary"
      class="fab-btn"
      @click="navigateToAdd"
    >
      <!-- Statically imported sub-sections which resolve themselves -->
      <AddFABIcon :page="page" />
      <AddFABTooltip :page="page" />
    </q-btn>
  </q-page-sticky>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import AddFABIcon from 'components/_common/Action/AddFAB/AddFABIcon.vue'
import AddFABTooltip from 'components/_common/Action/AddFAB/AddFABTooltip.vue'

defineOptions({ name: 'AddFAB' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

const nav = useResourceNav()

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'AddFAB',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))

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
