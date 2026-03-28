<template>
  <div class="add-page">
    <q-card flat bordered class="page-card">
      <q-card-section>
        <div class="page-title">
          <q-icon name="add_circle_outline" size="24px" color="primary" class="q-mr-sm" />
          Create {{ config?.ui?.pageTitle || config?.name || 'Record' }}
        </div>
      </q-card-section>

      <q-separator />

      <!-- Parent fields -->
      <q-card-section class="q-gutter-y-sm">
        <template v-for="field in resolvedFields" :key="field.header">
          <q-select
            v-if="field.type === 'status'"
            :model-value="parentForm[field.header]"
            :options="statusOptions"
            :label="field.label"
            dense
            outlined
            emit-value
            map-options
            @update:model-value="parentForm[field.header] = $event"
          />
          <q-input
            v-else
            :model-value="parentForm[field.header]"
            :label="field.label + (field.required ? ' *' : '')"
            :hint="field.hint"
            dense
            outlined
            @update:model-value="parentForm[field.header] = $event"
          />
        </template>
      </q-card-section>
    </q-card>

    <!-- Child resource tables -->
    <ChildRecordsTable
      v-for="group in childGroups"
      :key="group.resource.name"
      :title="group.resource.ui?.pageTitle || group.resource.name"
      :records="group.records"
      :fields="group.resolvedFields"
      :status-options="statusOptions"
      class="q-mt-sm"
      @add="addChildRecord(group.resource.name)"
      @remove="(idx) => removeChildRecord(group.resource.name, idx)"
      @update-field="(idx, header, val) => updateChildField(group.resource.name, idx, header, val)"
    />

    <!-- Actions -->
    <div class="row q-mt-md q-gutter-sm justify-end">
      <q-btn
        flat
        no-caps
        label="Cancel"
        icon="arrow_back"
        @click="navigateBack"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Create"
        icon="check"
        :loading="saving"
        @click="handleSave"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ChildRecordsTable from 'src/components/Masters/ChildRecordsTable.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useCompositeForm } from 'src/composables/useCompositeForm'

const router = useRouter()
const { scope, resourceSlug, config, resolvedFields } = useResourceConfig()
const {
  parentForm, childGroups, saving, statusOptions,
  initializeForCreate, addChildRecord, removeChildRecord,
  updateChildField, save
} = useCompositeForm(config)

onMounted(() => {
  initializeForCreate()
})

async function handleSave() {
  const response = await save()
  if (response.success) {
    const newCode = response.data?.code || response.data?.parentCode
    if (newCode) {
      router.push(`/${scope.value}/${resourceSlug.value}/${newCode}`)
    } else {
      router.push(`/${scope.value}/${resourceSlug.value}`)
    }
  }
}

function navigateBack() {
  router.push(`/${scope.value}/${resourceSlug.value}`)
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--master-ink);
  display: flex;
  align-items: center;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
