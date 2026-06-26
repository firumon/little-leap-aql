<template>
  <div class="aql-content-wrapper relative-position">
    <!-- Non-blocking linear progress bar for background syncing -->
    <q-linear-progress
      v-if="loading && hasData"
      indeterminate
      color="primary"
      class="absolute-top z-max"
      style="height: 3px;"
    />

    <!-- Blocking Loading State (Initial Fetch) -->
    <div v-if="loading && !hasData" class="flex flex-center q-py-xl min-height-200">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Record Not Found State -->
    <q-card v-else-if="requiresRecord && !recordExists" flat bordered class="empty-card q-ma-md">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="56px" color="grey-5" />
        <div class="text-h6 text-grey-7 q-mt-md">{{ notFoundTitle }}</div>
        <div class="text-caption text-grey-5 q-mt-sm">{{ notFoundMessage }}</div>
        <slot name="not-found-actions">
          <q-btn
            v-if="showBackToList"
            flat
            color="primary"
            label="Back to List"
            icon="arrow_back"
            class="q-mt-md"
            @click="navigateToList"
          />
        </slot>
      </q-card-section>
    </q-card>

    <!-- Empty Dataset State -->
    <q-card v-else-if="empty" flat bordered class="empty-card q-ma-md">
      <q-card-section class="text-center q-py-xl">
        <q-icon :name="emptyIcon" size="56px" color="grey-5" />
        <div class="text-h6 text-grey-7 q-mt-md">{{ emptyTitle }}</div>
        <div class="text-caption text-grey-5 q-mt-sm">{{ emptyMessage }}</div>
        <slot name="empty-actions" />
      </q-card-section>
    </q-card>

    <!-- Content Slot (Main Payload) -->
    <slot v-else />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

defineOptions({ name: 'AqlContentWrapper' })

const nav = useResourceNav()

const props = defineProps({
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  
  // For record-based pages (View, Edit, Action)
  requiresRecord: { type: Boolean, default: false },
  recordExists: { type: Boolean, default: true },
  
  // Customization props
  hasData: { type: Boolean, default: true },
  showBackToList: { type: Boolean, default: true },
  
  emptyIcon: { type: String, default: 'grid_off' },
  emptyTitle: { type: String, default: 'No records found' },
  emptyMessage: { type: String, default: 'There are no active records in this view.' },
  
  notFoundTitle: { type: String, default: 'Record not found' },
  notFoundMessage: { type: String, default: 'The requested record does not exist or has been deleted.' }
})

function navigateToList() {
  nav.goTo('index')
}
</script>

<style scoped>
.min-height-200 {
  min-height: 200px;
}
.empty-card {
  border-radius: 16px;
  border-color: var(--aql-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
