<template>
  <nav class="breadcrumb-bar" aria-label="Breadcrumb">
    <span class="crumb crumb-link" @click="$emit('click-root')">
      <q-icon name="home" size="16px" class="crumb-icon" />
      <span>{{ resourceTitle }}</span>
    </span>

    <template v-if="code">
      <q-icon name="chevron_right" size="16px" class="crumb-sep" />
      <span
        v-if="isActionView"
        class="crumb crumb-link"
        @click="$emit('click-code')"
      >
        {{ code }}
      </span>
      <span v-else class="crumb crumb-current">{{ code }}</span>
    </template>

    <template v-if="actionLabel">
      <q-icon name="chevron_right" size="16px" class="crumb-sep" />
      <span class="crumb crumb-current">{{ actionLabel }}</span>
    </template>
  </nav>
</template>

<script setup>
defineOptions({ name: 'Breadcrumb' })

defineProps({
  resourceTitle: { type: String, default: '' },
  code: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  isActionView: { type: Boolean, default: false }
})

defineEmits(['click-root', 'click-code'])
</script>

<style scoped>
.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px 10px;
  font-size: 13px;
  flex-wrap: wrap;
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.crumb-link {
  color: var(--q-primary);
  text-decoration: none;
  font-weight: 500;
  border-radius: 6px;
  padding: 2px 6px;
  transition: background 0.15s;
  cursor: pointer;
}

.crumb-link:hover {
  background: rgba(15, 43, 74, 0.08);
}

.crumb-current {
  color: var(--master-soft-ink, #51607a);
  font-weight: 600;
}

.crumb-sep {
  color: #94a3b8;
}

.crumb-icon {
  opacity: 0.7;
}
</style>
