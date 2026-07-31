<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="persistent"
    :maximized="maximized"
    transition-show="scale"
    transition-hide="scale"
    :transition-duration="220"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="aql-dialog-card shadow-10" :style="cardStyle">
      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <slot name="header">
        <q-card-section :class="['aql-dialog-header', `aql-dialog-header--${variant}`]">
          <div class="row items-center no-wrap">
            <q-avatar v-if="icon" class="aql-dialog-icon q-mr-md" size="40px">
              <q-icon :name="icon" size="22px" />
            </q-avatar>

            <div class="col column justify-center">
              <div class="aql-dialog-title">{{ title }}</div>
              <div v-if="subtitle" class="aql-dialog-subtitle">{{ subtitle }}</div>
            </div>

            <q-btn
              v-if="showClose"
              flat
              round
              dense
              icon="close"
              class="q-ml-sm"
              :disable="loading"
              v-close-popup
              @click="$emit('cancel')"
            >
              <q-tooltip>Close</q-tooltip>
            </q-btn>
          </div>
        </q-card-section>
      </slot>

      <q-separator />

      <!-- ── Body ────────────────────────────────────────────────────────── -->
      <q-card-section class="aql-dialog-body q-gutter-y-sm">
        <q-banner v-if="message" dense :class="['aql-dialog-banner', `aql-dialog-banner--${variant}`]">
          <template #avatar>
            <q-icon :name="messageIcon || variantIcon" size="20px" />
          </template>
          {{ message }}
        </q-banner>

        <slot />
      </q-card-section>

      <!-- ── Footer ──────────────────────────────────────────────────────── -->
      <template v-if="!hideActions">
        <q-separator />
        <q-card-actions align="right" class="aql-dialog-footer">
          <slot name="actions" :loading="loading" :disabled="disableConfirm">
            <q-btn
              flat
              no-caps
              :label="cancelLabel"
              :icon="cancelIcon || undefined"
              color="grey-7"
              class="aql-dialog-btn"
              :disable="loading"
              @click="$emit('cancel')"
            />
            <q-btn
              push
              glossy
              no-caps
              :label="confirmLabel"
              :icon="confirmIcon || undefined"
              :color="confirmColor"
              class="aql-dialog-btn"
              :loading="loading"
              :disable="loading || disableConfirm"
              @click="$emit('confirm')"
            />
          </slot>
        </q-card-actions>
      </template>
    </q-card>
  </q-dialog>
</template>

<script setup>
/**
 * AqlDialog — the shared premium modal shell.
 *
 * A stateless presentation wrapper (ARCHITECTURE RULES §8, `components/shared/`):
 * it imports no composable, store or service and holds no state of its own. Every
 * dialog in the app should compose this rather than hand-rolling a
 * `q-dialog > q-card > q-card-section` stack, so header/body/footer rhythm,
 * elevation, radius and transition stay identical everywhere.
 *
 * Three override levels, in increasing order of control:
 *   1. Props only — title/subtitle/icon/variant/labels. Covers most confirmations.
 *   2. Default slot — arbitrary body content (form fields, banners, guidance).
 *   3. `#header` / `#actions` slots — replace the chrome outright. `#actions` is
 *      scoped with `{ loading, disabled }` so a custom footer can mirror the
 *      built-in button state without re-deriving it.
 *
 * Carries no `<style>` block — all rules are `.aql-dialog-*` in `src/css/custom.scss`
 * (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'

defineOptions({ name: 'AqlDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },

  // ── Header ──
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon:     { type: String, default: '' },
  // Tints the header band and the message banner: the dialog's severity in one prop.
  variant:  {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'info', 'warning', 'negative', 'positive'].includes(v)
  },
  showClose: { type: Boolean, default: true },

  // ── Body ──
  // Convenience one-liner rendered as a q-banner above the default slot. Longer or
  // structured guidance belongs in the slot instead.
  message:     { type: String, default: '' },
  messageIcon: { type: String, default: '' },

  // ── Footer ──
  hideActions:   { type: Boolean, default: false },
  confirmLabel:  { type: String, default: 'Confirm' },
  confirmIcon:   { type: String, default: '' },
  confirmColor:  { type: String, default: 'primary' },
  cancelLabel:   { type: String, default: 'Cancel' },
  cancelIcon:    { type: String, default: '' },
  loading:       { type: Boolean, default: false },
  disableConfirm:{ type: Boolean, default: false },

  // ── Shell ──
  persistent: { type: Boolean, default: false },
  maximized:  { type: Boolean, default: false },
  width:      { type: String, default: '100%' },
  maxWidth:   { type: String, default: '460px' },
  minWidth:   { type: String, default: '320px' }
})

defineEmits(['update:modelValue', 'confirm', 'cancel'])

const cardStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  minWidth: props.minWidth
}))

const VARIANT_ICONS = {
  primary:  'info',
  info:     'info',
  warning:  'warning',
  negative: 'error',
  positive: 'check_circle'
}

const variantIcon = computed(() => VARIANT_ICONS[props.variant] || 'info')
</script>
