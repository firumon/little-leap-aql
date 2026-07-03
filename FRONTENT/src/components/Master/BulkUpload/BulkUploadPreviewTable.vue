<template>
  <q-card flat bordered>
    <q-card-section class="row items-center justify-between q-pb-none">
      <div>
        <div class="text-h6">Preview &amp; Edit</div>
        <div class="text-caption text-grey-7">{{ rows.length }} records ready</div>
      </div>
      <div class="q-gutter-sm">
        <q-btn
          label="Clear All"
          color="grey-7"
          icon="delete_sweep"
          flat
          no-caps
          @click="$emit('clearAll')"
        />
        <q-btn
          label="Upload All"
          color="positive"
          icon="cloud_upload"
          no-caps
          :loading="isUploading"
          @click="$emit('uploadAll')"
        />
      </div>
    </q-card-section>

    <q-separator class="q-mt-sm" />

    <q-table
      :rows="rows"
      :columns="columns"
      row-key="_rowId"
      flat
      bordered
      dense
      :rows-per-page-options="[10, 25, 50, 0]"
      class="bulk-preview-table"
    >
      <template #body-cell-_nature="props">
        <q-td :props="props">
          <q-chip
            :color="props.value === 'Update' ? 'orange' : 'green'"
            text-color="white"
            dense
            square
            size="sm"
            class="text-weight-bold"
          >
            {{ props.value }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-_actions="props">
        <q-td :props="props" class="text-center">
          <q-btn
            flat
            round
            dense
            color="negative"
            icon="delete_outline"
            size="sm"
            @click="$emit('deleteRow', props.row)"
          >
            <q-tooltip>Remove row</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <template #body-cell="props">
        <q-td :props="props" v-if="props.col.name !== '_nature' && props.col.name !== '_actions'">
          <div class="editable-cell cursor-pointer">
            <span>{{ props.value || '-' }}</span>
            <q-popup-edit
              v-model="props.row[props.col.field]"
              v-slot="scope"
              @save="(value) => $emit('cellEdited', props.row, props.col.field, value)"
            >
              <q-input v-model="scope.value" dense autofocus @keyup.enter="scope.set" />
            </q-popup-edit>
          </div>
        </q-td>
        <q-td :props="props" v-else />
      </template>
    </q-table>
  </q-card>
</template>

<script setup>
defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  isUploading: { type: Boolean, default: false }
})

defineEmits(['clearAll', 'uploadAll', 'deleteRow', 'cellEdited'])
</script>

<style scoped>
.editable-cell:hover {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.bulk-preview-table {
  max-height: 70vh;
}
</style>
