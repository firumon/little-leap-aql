<template>
  <div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center no-wrap">
        <q-icon name="edit_note" color="grey-7" size="sm" class="q-mr-sm" />
        <div class="col">
          <div class="text-subtitle1">{{ outletName || restock.OutletCode }}</div>
          <div class="text-caption text-grey-7">{{ restock.Code || 'Draft' }}</div>
        </div>
        <OutletProgressChip :progress="restock.Progress" />
      </q-card-section>
    </q-card>

    <q-card v-if="restock.ProgressRevisionRequiredComment || restock.ProgressRejectedComment" flat bordered class="q-mb-md bg-grey-1">
      <q-card-section>
        <div class="text-subtitle2 q-mb-xs">Previous Comments</div>
        <div v-if="restock.ProgressRevisionRequiredComment" class="text-caption" v-html="formatWorkflowCommentHtml(restock.ProgressRevisionRequiredComment)" />
        <div v-if="restock.ProgressRejectedComment" class="text-caption q-mt-sm" v-html="formatWorkflowCommentHtml(restock.ProgressRejectedComment)" />
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2">Items</div>
          <q-space />
          <q-btn label="Add Item" icon="add" size="sm" color="primary" @click="openAddDialog" />
        </div>
        <q-list v-if="props.rows.length" bordered separator class="rounded-borders">
          <q-item v-for="(row, idx) in props.rows" :key="idx" class="q-px-sm q-py-xs">
            <q-item-section>
              <span class="text-caption text-weight-medium">{{ itemLabel(row.SKU) }}</span>
            </q-item-section>
            <q-item-section side>
              <q-input
                :model-value="row.Quantity"
                type="number"
                dense outlined min="0"
                style="width: 60px"
                input-class="text-center text-bold"
                @update:model-value="val => updateRow(idx, { Quantity: Number(val) })"
              />
            </q-item-section>
            <q-item-section side>
              <q-btn dense flat round icon="delete" size="xs" color="negative" @click="removeRowAt(idx)" />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-grey text-center q-pa-md text-caption">
          No items added yet. Click "Add Item" to start.
        </div>
      </q-card-section>
    </q-card>

    <q-dialog v-model="addDialog" persistent>
      <q-card style="min-width: 350px; max-width: 90vw;">
        <q-card-section class="text-h6">Add Item</q-card-section>
        <q-card-section>
          <q-select
            v-model="addProduct"
            :options="addProductOptions"
            label="Product"
            outlined
            emit-value
            map-options
            @update:model-value="addSku = ''"
          />
          <div class="row items-center q-mt-xs q-col-gutter-xs">
            <q-select
              v-model="addSku"
              :options="addSkuOptions"
              label="Variant"
              outlined
              emit-value
              map-options
              :disable="!addProduct"
              class="col-8"
            />
            <q-input v-model.number="addQty" type="number" label="Qty" outlined :min="1" class="col-4" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :disable="!addSku || !addQty" @click="confirmAddItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <q-input
          v-model="comment"
          type="textarea"
          :label="isRevisionRequired ? 'Resubmission Comment (required)' : 'Submission Comment'"
          outlined rows="4"
        />
      </q-card-section>
    </q-card>

    <div class="row justify-end q-gutter-sm">
      <q-btn v-if="!isRevisionRequired" color="primary" label="Save Draft" :loading="saving" @click="$emit('save-draft')" />
      <q-btn color="secondary" :label="isRevisionRequired ? 'Resubmit' : 'Send For Approval'" :loading="saving" :disable="isRevisionRequired && !comment.trim()" @click="$emit('submit', comment)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import OutletProgressChip from './OutletProgressChip.vue'
import { text } from '../../../composables/operations/outlets/outletOperationsMeta.js'

defineOptions({ name: 'RestockDraftView' })

const props = defineProps({
  restock: { type: Object, required: true },
  rows: { type: Array, required: true },
  skuOptions: { type: Array, required: true },
  outletName: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  formatWorkflowCommentHtml: { type: Function, required: true },
  addRow: { type: Function, required: true },
  updateRow: { type: Function, required: true },
  removeRow: { type: Function, required: true }
})

defineEmits(['save-draft', 'submit'])

const comment = ref('')

const isRevisionRequired = computed(() => text(props.restock.Progress) === 'REVISION_REQUIRED')

function itemLabel(skuCode) {
  const sku = props.skuOptions.find(s => s.value === skuCode)
  if (!sku) return skuCode
  const parts = (sku.label || '').split(' · ')
  const code = parts[0] || ''
  const product = parts.length > 1 ? parts[1] : ''
  const variant = parts.length > 2 ? parts.slice(2).join(' · ') : ''
  return `${code} · ${product}${variant ? ` · ${variant}` : ''}`
}

const addDialog = ref(false)
const addProduct = ref('')
const addSku = ref('')
const addQty = ref(1)

const addProductOptions = computed(() => {
  const seen = new Set()
  return (props.skuOptions || []).reduce((acc, sku) => {
    const parts = (sku.label || '').split(' · ')
    const name = (parts.length > 1 ? parts[1] : parts[0]).trim()
    if (name && !seen.has(name)) { seen.add(name); acc.push({ label: name, value: name }) }
    return acc
  }, [])
})

const addSkuOptions = computed(() => {
  if (!addProduct.value) return []
  return (props.skuOptions || []).filter(sku => {
    const parts = (sku.label || '').split(' · ')
    return (parts.length > 1 ? parts[1].trim() : parts[0].trim()) === addProduct.value
  }).map(sku => {
    const parts = (sku.label || '').split(' · ')
    const variant = parts.length > 2 ? parts.slice(2).join(' · ') : parts[0]
    return { label: variant, value: sku.value }
  })
})

function openAddDialog() {
  addProduct.value = ''
  addSku.value = ''
  addQty.value = 1
  addDialog.value = true
}

function confirmAddItem() {
  if (!addSku.value || !addQty.value) return
  props.addRow()
  props.updateRow(props.rows.length - 1, { SKU: addSku.value, Quantity: Number(addQty.value) })
  addDialog.value = false
}

function removeRowAt(idx) { props.removeRow(idx) }
</script>
