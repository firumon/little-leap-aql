<template>
  <div v-if="!loading && hasCode" class="action-bar">
    <div class="action-bar__summary q-px-xs">
      <div class="action-bar__total-label">Estimated Total</div>
      <div class="action-bar__total-value">{{ formatCurrency(grandTotal) }}</div>
    </div>
    <div class="pr-review-page__btn-grid">
      <q-btn
        outline color="primary"
        icon="save" label="Save Draft"
        class="action-bar__btn"
        style="height:48px;border-radius:12px;font-weight:700;font-size:14px"
        :loading="saving"
        @click="$emit('save-draft')"
      />
      <q-btn
        unelevated icon-right="send" label="Submit PR"
        class="submit-btn action-bar__btn"
        style="height:48px;border-radius:12px;font-weight:700;font-size:14px"
        :loading="submitting"
        :disable="itemsCount === 0"
        @click="$emit('submit')"
      >
        <q-tooltip v-if="itemsCount === 0">Add at least one item to submit</q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: { type: Boolean, required: true },
  hasCode: { type: Boolean, required: true },
  grandTotal: { type: Number, required: true },
  saving: { type: Boolean, required: true },
  submitting: { type: Boolean, required: true },
  itemsCount: { type: Number, required: true },
  formatCurrency: { type: Function, required: true }
})

defineEmits(['save-draft', 'submit'])
</script>

<style scoped>
.action-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-bar__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.pr-review-page__btn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: stretch;
  flex-shrink: 0;
}

.action-bar__btn {
  width: 100%;
}
</style>

