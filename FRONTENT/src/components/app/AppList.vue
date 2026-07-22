<template>
  <!-- Thin app-level wrapper over the abstract list primitive.
       Every attribute (props + listeners) and every slot passes straight through,
       so AppList keeps the full abstract/List.vue API without redeclaring it. -->
  <List v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </List>
</template>

<script setup>
import List from 'components/abstract/List.vue'

defineOptions({ name: 'AppList', inheritAttrs: false })
</script>
