<template>
  <template v-for="childRes in childResources" :key="childRes.name">
    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section>
        <div class="section-title">{{ childRes.ui?.pageTitle || childRes.name }}</div>
        <div v-if="!childRecords[childRes.name]?.length" class="text-grey-6 text-center q-py-md">
          No {{ (childRes.ui?.pageTitle || childRes.name).toLowerCase() }} found
        </div>
        <q-markup-table v-else flat dense separator="horizontal" class="child-view-table">
          <thead>
            <tr>
              <th class="text-left">Code</th>
              <th
                v-for="field in getChildFields(childRes)"
                :key="field.header"
                class="text-left"
              >
                {{ field.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="childRow in childRecords[childRes.name]" :key="childRow.Code">
              <td class="text-primary text-weight-medium">{{ childRow.Code }}</td>
              <td v-for="field in getChildFields(childRes)" :key="field.header">
                {{ childRow[field.header] || '-' }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card-section>
    </q-card>
  </template>
</template>

<script setup>
defineProps({
  childResources: { type: Array, default: () => [] },
  childRecords: { type: Object, default: () => ({}) }
})

function getChildFields(childRes) {
  const uiFields = childRes?.ui?.fields
  if (Array.isArray(uiFields) && uiFields.length) {
    return uiFields.filter((f) => f.header !== 'Code' && f.header !== 'ParentCode')
  }
  const headers = Array.isArray(childRes?.headers) ? childRes.headers : []
  return headers
    .filter((h) => !['Code', 'ParentCode', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(h))
    .map((h) => ({
      header: h,
      label: h.replace(/([a-z])([A-Z])/g, '$1 $2'),
      type: 'text'
    }))
}
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
.child-view-table { font-size: 13px; }
.child-view-table th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #64748b; padding: 8px 12px; }
.child-view-table td { padding: 6px 12px; }
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
