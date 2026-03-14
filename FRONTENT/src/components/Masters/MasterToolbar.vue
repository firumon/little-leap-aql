<template>
  <q-card flat bordered class="toolbar-card q-mt-sm">
    <q-card-section class="q-pa-sm q-pa-md">
      <div class="row q-col-gutter-sm items-center">
        <div class="col-12 col-md">
          <q-input
            :model-value="searchTerm"
            outlined
            dense
            clearable
            debounce="180"
            placeholder="Search code, name, or any field"
            class="search-input"
            @update:model-value="$emit('update:searchTerm', $event)"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
        <div class="col-12 col-md-auto row items-center q-gutter-sm justify-between">
          <q-toggle
            :model-value="showInactive"
            label="Include Inactive"
            color="primary"
            @update:model-value="onToggleInactive"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  searchTerm: {
    type: String,
    default: ''
  },
  showInactive: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:searchTerm', 'update:showInactive', 'reload'])

function onToggleInactive(value) {
  emit('update:showInactive', value)
  emit('reload')
}
</script>

<style scoped>
.toolbar-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.search-input :deep(.q-field__control) {
  border-radius: 12px;
  background: #fff;
}

@keyframes rise-in {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
