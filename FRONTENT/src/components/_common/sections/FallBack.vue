<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  /><q-card v-else>
    <q-card-section>
      I am FallBack Section.
    </q-card-section>
  </q-card>
</template>

<script setup>
import {useCommonSection} from "src/composables/resources/useCommonSection.js";

const {
  resolvedComponent,
  finalProps,
  propModifier,
  sectionsReady
} = useCommonSection({
  sectionName: 'Header',
  page: props.page,
  preparedProps,
  evaluateKeys: ['label', 'caption', 'icon', 'chip', 'chipColor', 'chipTextColor']
})
</script>
