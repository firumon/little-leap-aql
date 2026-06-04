<template>
  <q-card flat bordered>
    <q-card-section>
      <q-list>
        <q-item>
          <q-item-section>
            <q-item-label caption>Source Warehouse</q-item-label>
            <q-item-label class="text-weight-bold">{{ warehouseName }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label caption>Target Outlet</q-item-label>
            <q-item-label class="text-weight-bold">{{ outletName }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>

  <!-- Added items list -->
  <div class="text-subtitle2 text-grey-8 q-mt-md text-weight-bold">Restock Summary - {{ addedItems.length }} item{{ addedItems.length > 1 ? 's' : '' }}</div>
  <q-card flat bordered>
    <q-card-section>
      <AqlGroupedList
        :group-key="item => item.productCode" header-label="productName"
        :header-chip="group => 'Total: ' + group.items.map(item => item.OutletQuantity + item.Quantity).reduce((a, b) => a + b, 0)"
        :items="addedItems" item-key="SKU" empty-text="No items to restock." :chip="(item) => `+${item.Quantity}`"
        :layout="['label','caption']"
        :content="[
      'skuLabel',
      (item) => `Outlet Stock Update: ${item.OutletQuantity} → ${item.OutletQuantity+item.Quantity}`
    ]"
      />

    </q-card-section>
  </q-card>

  <div class="q-py-md animate-fade-in">

    <!-- Submission Settings -->
    <div class="text-subtitle2 text-grey-8 q-mb-xs">Submission Settings</div>
    <q-card flat bordered class="q-pa-md bg-white rounded-borders border-grey q-mb-md">
      <div class="column q-gutter-y-sm">
        <div>
          <div class="text-caption text-grey-6 q-mb-xs">Submission Mode</div>
          <q-select
            :model-value="submissionMode"
            :options="modeOptions"
            emit-value
            map-options
            outlined
            dense
            options-dense
            class="bg-white rounded-borders"
            @update:model-value="$emit('update-mode', $event)"
          >
            <template #prepend>
              <q-icon :name="modeIcon" :color="modeColor" />
            </template>
          </q-select>
        </div>

        <div v-if="submissionMode === 'APPROVED'" class="row items-center q-pa-sm bg-green-1 rounded-borders text-green-9 text-caption text-bold border-green border-dashed">
          <q-icon name="check_circle" size="xs" class="q-mr-xs" />
          <span>Auto-Approved: Deduction of stock from warehouse will happen instantly.</span>
        </div>

        <div>
          <div class="text-caption text-grey-6 q-mb-xs">Comment (Optional)</div>
          <q-input
            :model-value="submitComment"
            type="textarea"
            outlined
            placeholder="Add comments here..."
            class="bg-white rounded-borders"
            @update:model-value="$emit('update-comment', $event)"
          />
        </div>
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AqlGroupedList from "../../shared/AqlGroupedList.vue";

defineOptions({ name: 'DirectRestockSummaryStep' })

const props = defineProps({
  addedItems: { type: Array, default: () => [] },
  warehouseName: { type: String, default: '' },
  outletName: { type: String, default: '' },
  submissionMode: { type: String, default: 'APPROVED' },
  submitComment: { type: String, default: '' }
})

const emit = defineEmits(['update-mode', 'update-comment'])

const modeOptions = [
  { label: 'Approved (Instant Direct Restock)', value: 'APPROVED' },
  { label: 'Pending Approval (Normal Approval Flow)', value: 'PENDING_APPROVAL' },
  { label: 'Draft', value: 'DRAFT' }
]

const modeIcon = computed(() => {
  if (props.submissionMode === 'APPROVED') return 'check_circle'
  if (props.submissionMode === 'PENDING_APPROVAL') return 'hourglass_top'
  return 'drafts'
})

const modeColor = computed(() => {
  if (props.submissionMode === 'APPROVED') return 'positive'
  if (props.submissionMode === 'PENDING_APPROVAL') return 'orange'
  return 'grey-6'
})
</script>

<style scoped>
.border-grey {
  border: 1px solid #e2e8f0;
}
.bg-green-1 {
  background-color: #e8f5e9;
}
.text-green-9 {
  color: #1b5e20;
}
.border-green {
  border: 1px solid #c8e6c9;
}
.border-dashed {
  border-style: dashed;
}
</style>
