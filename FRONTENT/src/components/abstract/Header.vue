<template>
  <q-card flat bordered class="brand-header-card">
    <q-card-section class="q-px-xs">
      <q-list>
        <q-item>
          <q-item-section side v-if="icon">
            <q-icon :name="icon" :size="iconSize" :color="iconColor" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold text-primary text-h6">{{ title }}</q-item-label>
            <q-item-label caption>{{ subtitle }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="$slots.side">
            <slot name="side" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  iconSize: {
    type: String,
    default: 'sm'
  },
  iconColor: {
    type: String,
    default: 'primary'
  }
})
</script>
