<template>
  <q-card flat bordered class="child-table-card">
    <q-card-section class="q-pa-sm row items-center no-wrap">
      <div class="col">
        <div class="child-title">{{ title }}</div>
        <div class="child-subtitle">{{ records.length }} record{{ records.length !== 1 ? 's' : '' }}</div>
      </div>
      <q-btn
        v-if="!readonly"
        flat
        round
        dense
        icon="add"
        color="primary"
        @click="$emit('add')"
      >
        <q-tooltip>Add {{ title }}</q-tooltip>
      </q-btn>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-pa-none">
      <div v-if="!visibleRecords.length" class="empty-children">
        <q-icon name="playlist_add" size="24px" color="grey-5" />
        <div>No {{ title.toLowerCase() }} added yet</div>
      </div>

      <q-markup-table v-else flat dense separator="horizontal" class="child-table">
        <thead>
          <tr>
            <th class="text-left" style="width: 40px">#</th>
            <th
              v-for="field in fields"
              :key="field.header"
              class="text-left"
            >
              {{ field.label }}
              <span v-if="field.required" class="text-negative">*</span>
            </th>
            <th v-if="!readonly" class="text-center" style="width: 48px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(record, index) in visibleRecords" :key="record._key">
            <td class="text-grey-6">{{ index + 1 }}</td>
            <td v-for="field in fields" :key="field.header">
              <template v-if="readonly">
                {{ record.data[field.header] || '-' }}
              </template>
              <template v-else>
                <q-select
                  v-if="field.type === 'status'"
                  :model-value="record.data[field.header]"
                  :options="statusOptions"
                  dense
                  borderless
                  emit-value
                  map-options
                  class="child-input"
                  @update:model-value="$emit('update-field', index, field.header, $event)"
                />
                <q-input
                  v-else
                  :model-value="record.data[field.header]"
                  dense
                  borderless
                  :placeholder="field.label"
                  class="child-input"
                  @update:model-value="$emit('update-field', index, field.header, $event)"
                />
              </template>
            </td>
            <td v-if="!readonly" class="text-center">
              <q-btn
                flat
                round
                dense
                icon="close"
                size="sm"
                color="negative"
                @click="$emit('remove', index)"
              >
                <q-tooltip>Remove</q-tooltip>
              </q-btn>
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Items' },
  records: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
  statusOptions: {
    type: Array,
    default: () => [
      { label: 'Active', value: 'Active' },
      { label: 'Inactive', value: 'Inactive' }
    ]
  }
})

defineEmits(['add', 'remove', 'update-field'])

const visibleRecords = computed(() => {
  return props.records.filter((r) => r._action !== 'deactivate')
})
</script>

<style scoped>
.child-table-card {
  border-radius: 14px;
  border-color: var(--master-border, #dbe3ed);
  background: rgba(255, 255, 255, 0.95);
}

.child-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--master-ink, #0f172a);
}

.child-subtitle {
  font-size: 11px;
  color: #64748b;
}

.empty-children {
  text-align: center;
  padding: 24px 16px;
  color: #94a3b8;
  font-size: 13px;
  display: grid;
  gap: 6px;
  justify-items: center;
}

.child-table {
  font-size: 13px;
}

.child-table th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
  padding: 8px 12px;
}

.child-table td {
  padding: 4px 8px;
}

.child-input :deep(.q-field__control) {
  min-height: 32px;
}

.child-input :deep(.q-field__native) {
  font-size: 13px;
  padding: 2px 4px;
}
</style>
