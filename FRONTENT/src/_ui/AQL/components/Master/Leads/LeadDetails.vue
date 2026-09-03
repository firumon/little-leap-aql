<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="45%" class="q-mb-sm" />
        <q-skeleton type="text" width="70%" />
      </q-card-section>

      <template v-else-if="lead">
        <q-list>
          <q-item class="q-py-md">
<!--            <q-item-section side>
              <q-icon :name="progressIcon(lead)" :color="progressColor(lead)" />
            </q-item-section>-->
            <q-item-section>
              <q-item-label class="text-subtitle2 text-weight-bold">{{ leadName }}</q-item-label>
              <q-item-label caption>{{ lead.Code }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge rounded :color="progressColor(lead)" :label="progressLabel(lead)" />
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator v-if="visibleLines.length" />

        <q-card-section v-if="visibleLines.length">
          <div class="aql-detail-grid">
            <div
              v-for="(line, index) in visibleLines"
              :key="line.label"
              class="aql-detail-line items-center aql-detail-row"
              :style="rowDelay(index)"
            >
              <span class="aql-detail-key">{{ line.label }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                <a v-if="line.tel" class="aql-visit-link" :href="`tel:${line.value}`">{{ line.value }}</a>
                <span v-else>{{ line.value }}</span>
              </span>
            </div>
          </div>
        </q-card-section>

        <template v-if="stampComment">
          <q-separator />
          <q-card-section>
            <div class="text-overline text-weight-bold text-grey-6 q-mb-xs">
              {{ progressLabel(lead) }} Comment
            </div>
            <div class="text-body2">{{ stampComment }}</div>
            <div v-if="stampBy" class="text-caption text-grey-7 q-mt-xs">by {{ stampBy }}</div>
          </q-card-section>
        </template>
      </template>

      <q-card-section v-else class="text-caption text-grey-7">
        This lead record could not be loaded.
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useLeadViewContext } from 'src/_ui/AQL/composables/Master/Leads/View/useLeadViewContext'
import {
  progressColor,
  progressIcon,
  progressLabel,
  progressComment,
  progressBy
} from 'src/_resource/Master/Leads/composables/useLeadProgress'
import { toDateOnly } from 'src/utils/dateHelpers'

defineOptions({ name: 'LeadsLeadDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Lead Details' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, lead, pending } = useLeadViewContext()

const finalTitle = computed(() => evaluate(props.title))
const leadName = computed(() => lead.value?.Name || lead.value?.Code || '—')

const stampComment = computed(() => progressComment(lead.value))
const stampBy = computed(() => progressBy(lead.value))

// Blank rows are dropped rather than padded with an em dash.
const visibleLines = computed(() => {
  const row = lead.value
  if (!row) return []
  return [
    { label: 'Type', value: row.Type || '' },
    { label: 'Contact Person', value: row.ContactPerson1 || '' },
    { label: 'Phone', value: row.Phone1 || '', tel: true },
    { label: 'Contact Person 2', value: row.ContactPerson2 || '' },
    { label: 'Phone 2', value: row.Phone2 || '', tel: true },
    { label: 'Area', value: row.Area || '' },
    { label: 'City', value: row.City || '' },
    { label: 'Province', value: row.Province || '' },
    { label: 'Country', value: row.Country || '' },
    { label: 'Access Region', value: row.AccessRegion || '' },
    { label: 'Created On', value: toDateOnly(row.CreatedAt) }
  ].filter((line) => String(line.value ?? '').trim())
})

function rowDelay (index) {
  return { animationDelay: `${index * 40}ms` }
}
</script>
