<template>
  <div v-if="!childRecords?.length" class="text-grey-7 text-center q-py-md">No records</div>
  <q-card v-else flat bordered class="page-card aql-premium-gradient-card">
    <q-card-section>
      <q-markup-table flat class="child-table aql-child-table bg-transparent">
        <thead>
          <tr>
            <th v-for="field in fields" :key="field.header" class="text-left">{{ field.label }}</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="compact-row">
          <!-- No Code column: the code identifies the row, it doesn't describe
               it. The whole row stays clickable and navigates by `record.Code`. -->
          <tr
            v-for="record in childRecords"
            :key="record.Code"
            class="cursor-pointer"
            @click="onRowClick($event, record)"
          >
            <!-- Cell values render through the same `_fields/<type>/View.vue`
                 base components as the detail grid — no type branches here.
                 `compact: true` in the config tells each one to stay on a single
                 dense line (chip sizing, no preview cards, no pre-line wrap). -->
            <td v-for="field in fields" :key="field.header" class="text-left">
              <component
                :is="resolveFieldComponent(resolveFieldType(field), 'view')"
                :model-value="record?.[field.header]"
                :record="record"
                :config="cellConfig(record, field)"
                :header="field.header"
              />
            </td>
          </tr>
        </TransitionGroup>
      </q-markup-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
/**
 * INVARIANT: leaf child-grid renderer only. Never renders an audit trail
 * (ViewAudit / ViewRecordWithAudit); audit is emitted exclusively by the
 * top-level 'Audit' ordered section in View.vue.
 */
import { resolveFieldComponent, resolveFieldType } from 'components/_fields/useFieldResolver'
import { resolveDisplayValue } from 'src/utils/appHelpers'

defineOptions({ name: 'ContentsViewChildCompact', inheritAttrs: false })

const props = defineProps({
  childResource: { type: Object, required: true },
  childRecords: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] }
})

const emit = defineEmits(['view-child'])

// Cell context handed to the resolved `_fields` View component. Mirrors
// ViewRecord.getColProps so the two containers agree on every cell, minus the
// per-column `_ui` modifier layer (compact tables resolve no column overrides).
function cellConfig (record, field) {
  return {
    value: record?.[field.header],
    record,
    field,
    resourceName: props.childResource?.name || '',
    columnName: field.header,
    options: field.options,
    displayValue: resolveDisplayValue(record?.[field.header]),
    compact: true
  }
}

// A `link`/`tel` cell renders a real anchor; letting that click also bubble to
// the row would navigate away from the tab the browser just opened.
function onRowClick (event, record) {
  if (event?.target?.closest?.('a')) return
  emit('view-child', props.childResource, record.Code)
}
</script>
