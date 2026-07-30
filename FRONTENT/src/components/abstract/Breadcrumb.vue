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
/**
 * Pure, stateless breadcrumb renderer. All styling (`.breadcrumb-bar`, `.crumb*`)
 * lives in `src/css/custom.scss` per ARCHITECTURE RULES §7 — this component holds
 * no <style> block.
 */
defineOptions({ name: 'Breadcrumb' })

defineProps({
  resourceTitle: { type: String, default: '' },
  code: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  isActionView: { type: Boolean, default: false }
})

defineEmits(['click-root', 'click-code'])
</script>
