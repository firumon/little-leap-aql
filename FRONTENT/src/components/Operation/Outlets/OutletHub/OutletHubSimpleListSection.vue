<template>
  <q-card flat bordered class="bg-white shadow-1">
    <q-card-section class="row items-center justify-between">
      <div class="row items-center">
        <q-icon :name="icon" :color="color" size="22px" class="q-mr-sm" />
        <div>
          <div class="text-subtitle1 text-weight-bold" :class="`text-${color}`">{{ title }}</div>
          <div class="text-caption text-grey-7">{{ subtitle }}</div>
        </div>
      </div>
      <q-btn
        v-if="actionLabel"
        flat
        dense
        :color="color"
        icon="add"
        :label="actionLabel"
        :disable="!selectedOutletCode"
        @click="$emit('action')"
      />
    </q-card-section>
    <q-separator />
    <q-card-section class="q-pa-none">
      <AqlList
        :items="items"
        item-key="Code"
        :icon="icon"
        :icon-color="color"
        :content="content"
        :meta="meta"
        :meta-layout="metaLayout"
        :empty-text="emptyText"
        :clickable="clickable"
        @click="$emit('navigate', $event)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import AqlList from '../../../shared/AqlList.vue'

defineOptions({ name: 'OutletHubSimpleListSection' })

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, required: true },
  color: { type: String, default: 'primary' },
  items: { type: Array, required: true },
  content: { type: Array, required: true },
  meta: { type: Array, default: () => [] },
  metaLayout: { type: Array, default: () => ['caption'] },
  emptyText: { type: String, default: 'No items found.' },
  clickable: { type: Boolean, default: true },
  actionLabel: { type: String, default: '' },
  selectedOutletCode: { type: String, default: '' }
})

defineEmits(['action', 'navigate'])
</script>
