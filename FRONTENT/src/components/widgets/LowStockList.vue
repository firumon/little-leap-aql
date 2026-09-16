<template>
  <RankedListBase
    v-bind="$attrs"
    row-spacing="cozy"
    bar-style="capsule"
    :show-rank-number="false"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </RankedListBase>
</template>

<script setup>
import RankedListBase from 'src/components/widgets/RankedListBase.vue'

defineOptions({
  inheritAttrs: false,
  minHeight: 220
})
</script>
