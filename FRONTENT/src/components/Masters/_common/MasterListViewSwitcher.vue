<template>
  <q-card v-if="views.length" flat bordered class="view-switcher-card">
    <q-card-section class="q-pa-sm q-pa-md-sm">
      <div class="view-chips">
        <q-chip
          v-for="view in views"
          :key="view.name"
          clickable
          :outline="activeViewName !== view.name"
          :color="chipColor(view)"
          :text-color="activeViewName === view.name ? 'white' : chipColor(view)"
          class="view-chip"
          @click="$emit('update:activeViewName', view.name)"
        >
          {{ view.name }}
          <q-badge
            :color="activeViewName === view.name ? 'white' : chipColor(view)"
            :text-color="activeViewName === view.name ? chipColor(view) : 'white'"
            floating
            rounded
            class="count-badge"
          >
            {{ counts[view.name] ?? 0 }}
          </q-badge>
        </q-chip>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  views: {
    type: Array,
    default: () => []
  },
  activeViewName: {
    type: String,
    default: ''
  },
  counts: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['update:activeViewName'])

function chipColor(view) {
  return view.color || 'grey-7'
}
</script>

<style scoped>
.view-switcher-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.92);
}

.view-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.view-chip {
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  position: relative;
  padding-right: 28px;
}

.view-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.count-badge {
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  top: -6px;
  right: -6px;
}
</style>
