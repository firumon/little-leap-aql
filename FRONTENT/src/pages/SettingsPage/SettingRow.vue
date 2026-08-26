<template>
  <q-item class="q-py-md">
    <q-item-section>
      <q-item-label class="text-weight-medium text-grey-9">{{ title }}</q-item-label>
      <q-item-label caption class="text-grey-7">{{ caption }}</q-item-label>
    </q-item-section>
    <q-item-section side class="setting-control">
      <slot />
    </q-item-section>
  </q-item>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  caption: { type: String, default: '' }
})
</script>

<style scoped>
.setting-control {
  align-items: flex-end;
}
</style>
