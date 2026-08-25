<template>
  <div v-if="pending || invoice">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="55%" class="q-mb-sm" />
        <q-skeleton type="text" width="30%" />
      </q-card-section>

      <q-card-section v-else>
        <!-- The bill NAMES the card, and the whole row is the link: an officer checking a
             credit against what was charged wants the invoice itself one tap away. -->
        <q-item
          v-ripple
          clickable
          class="q-px-none"
          :disable="!invoice.found"
          @click="openInvoice"
        >
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-subtitle1 text-weight-medium">{{ invoice.code }}</q-item-label>
            <q-item-label caption>{{ headerCaption }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="invoice.found" side>
            <q-icon name="chevron_right" color="grey-6" />
          </q-item-section>
        </q-item>

        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>

        <q-banner v-if="notes.length" dense rounded class="bg-orange-1 text-body2 q-mt-sm">
          <template #avatar><q-icon name="info" color="warning" /></template>
          <div v-for="note in notes" :key="note">{{ note }}</div>
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewBilledOnInvoice', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Billed On' }
})

const { evaluate, ui } = useReturnViewContext()
const { pending, sourceInvoice, invoiceResources } = useReturnView()
const nav = useResourceNav()

const finalTitle = computed(() => evaluate(props.title))

const invoice = computed(() => sourceInvoice.value)

const headerCaption = computed(() => {
  const row = invoice.value
  if (!row) return ''
  if (!row.found) return 'This invoice is not in the loaded records — the code is kept as recorded.'
  return [row.date, row.username].filter(Boolean).join(' • ')
})

const lines = computed(() => {
  const row = invoice.value
  if (!row || !row.found) return []
  return [
    { label: 'Invoiced Quantity', value: row.billedQty },
    { label: 'Invoiced Unit Price', value: row.billedUnitPrice },
    { label: 'Invoiced Line Value', value: row.billedLineTotal },
    { label: 'Invoice Total', value: row.invoiceTotal },
    { label: 'Price List', value: row.priceListCode }
  ].filter((line) => String(line.value).trim())
})

const notes = computed(() => {
  const row = invoice.value
  if (!row || !row.found) return []
  const out = []
  if (!row.priceMatches) {
    out.push('The credit value on this return differs from the price this item was invoiced at.')
  }
  if (row.overReturned) {
    out.push(`This return covers ${row.returnedQty} units, more than the ${row.billedQty} billed on this invoice.`)
  }
  return out
})

function openInvoice () {
  const row = invoice.value
  if (!row?.found) return
  // `resourceSlug` is the param `useResourceNav` reads — the scope resolves itself from the
  // slug, so it is not restated here.
  nav.goTo('view', { code: row.code, resourceSlug: 'outlet-consumption-invoices' })
}

onMounted(() => { invoiceResources.forEach((res) => res.reload()) })

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
