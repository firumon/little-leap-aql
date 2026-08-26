<template>
  <q-card flat bordered class="settings-card q-mb-lg">
    <q-card-section class="row items-center no-wrap q-pb-sm">
      <q-avatar rounded size="36px" class="q-mr-md bg-grey-3">
        <q-icon :name="icon" size="20px" color="grey-8" />
      </q-avatar>
      <div class="col">
        <div class="text-subtitle1 text-weight-bold text-grey-9">{{ title }}</div>
        <div class="text-caption text-grey-7">{{ caption }}</div>
      </div>
      <q-badge outline color="grey-7" label="Coming soon" class="q-px-sm" />
    </q-card-section>

    <q-separator inset />

    <q-list>
      <slot />
    </q-list>
  </q-card>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  caption: { type: String, default: '' },
  icon: { type: String, default: 'tune' }
})
</script>

<style scoped>
.settings-card {
  border-radius: 14px;
}
</style>
