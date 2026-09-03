<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat class="page-card">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="35%" class="q-mb-sm" />
        <q-skeleton type="text" width="85%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-caption text-grey-7">
        {{ finalEmptyText }}
      </q-card-section>

      <AppList
        v-else
        :items="rows"
        item-key="code"
        :content="[dateAndUser, commentOf]"
        :chip="(row) => row.progressLabel"
        :chip-color="(row) => row.progressColor"
        :icon="(row) => row.progressIcon"
        :color="(row) => row.progressColor"
        @click="openRow"
      />
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AppList from 'components/app/AppList.vue'
import { useFollowUpViewContext } from 'src/_ui/AQL/composables/Operation/LeadFollowUps/View/useFollowUpViewContext'
import { progressComment } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'

defineOptions({ name: 'LeadFollowUpsOtherFollowUps', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Other Follow Ups' },
  limit: { type: [Number, String, Function], default: 6 },
  emptyText: { type: [String, Function], default: 'This lead has no other follow-ups.' },
  padding: { type: [String], default: 'sm' }
})

const { evaluate, otherFollowUps, leadPending, openFollowUp } = useFollowUpViewContext()

const finalTitle = computed(() => evaluate(props.title))
const finalEmptyText = computed(() => evaluate(props.emptyText))
const pending = computed(() => leadPending.value)

// Coerced loosely: a limit arriving from a sheet-authored props block is a string.
const finalLimit = computed(() => {
  const raw = Number(evaluate(props.limit))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 6
})

const rows = computed(() => otherFollowUps.value.slice(0, finalLimit.value))

function dateAndUser (row) {
  return [row.Date, row.Username].filter((part) => String(part ?? '').trim()).join(' • ')
}

// A completed follow-up shows what came of it; any other outcome shows why it moved.
function commentOf (row) {
  return row.outcome || progressComment(row) || ''
}

function openRow (row) {
  openFollowUp(row?.code ?? row)
}
</script>
