<template>
  <div>
    <SectionDividerLabel :label="title" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" />
      </q-card-section>

      <q-card-section v-else-if="!track" class="text-center q-py-md">
        <div :class="ui.emptyCaptionClass">Nothing to show</div>
      </q-card-section>

      <q-card-section v-else>
        <!-- The headline: is this track owed, and has it been settled. One row, because
             that is the entire question a reader opens this card to answer. -->
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col-auto">
            <q-icon :name="track.icon" :color="track.color" size="24px" />
          </div>
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium">{{ track.state }}</div>
            <div class="text-caption text-grey-8">{{ caption }}</div>
          </div>
          <div class="col-auto">
            <q-badge rounded :color="track.color" :label="track.required ? 'Required' : 'Not required'" />
          </div>
        </div>

        <!-- Supporting facts, and only the ones that resolved. A track that is not required
             has none, and the card correctly stops at the headline above rather than
             printing a column of em dashes. -->
        <div v-if="lines.length" :class="[ui.detailGridClass, 'q-mt-sm']">
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

        <div v-if="note" class="q-mt-sm">
          <div class="text-caption text-grey-7 text-uppercase">{{ noteLabel }}</div>
          <div class="text-body2" style="white-space: pre-line">{{ note }}</div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletReturns › View › TrackStatusCard — resource-private sub-component (§2.3).
 *
 * ONE card, rendered twice: once for the commercial track and once for the physical one.
 * The two ask the identical three-part question — is this owed, has it been settled, and
 * what are the supporting facts — so they are one component parameterised by a track
 * object, not two near-identical files (§3.5). Building them separately is how the
 * "Required / Not required" badge ends up meaning two different things on one page.
 *
 * A LEAF: it holds no context, injects nothing and derives nothing. Its two callers
 * (`CommercialStatus.vue`, `WarehouseStatus.vue`) each read `useReturnView` and hand it a
 * track projection already built by that one composable, which is what keeps both cards
 * reading the same derived state (§7.4).
 *
 * `inheritAttrs: false` — page props travel down the whole placeholder chain, and with
 * fallthrough on, a `Props<Identity>` object would be written onto the root element as
 * `propspageheader="[object Object]"` (ARCHITECTURE RULES §8).
 *
 * No `<style>` block (§7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

defineOptions({ name: 'OutletReturnsViewTrackStatusCard', inheritAttrs: false })

const props = defineProps({
  title: { type: String, default: '' },
  /** The track projection from `useReturnView` — `null` while the record is unresolved. */
  track: { type: Object, default: null },
  /** One sentence saying what this track MEANS, so the state above it is readable. */
  caption: { type: String, default: '' },
  /** `[{ label, value }]`, already filtered by the caller to what actually resolved. */
  lines: { type: Array, default: () => [] },
  note: { type: String, default: '' },
  noteLabel: { type: String, default: 'Note' },
  pending: { type: Boolean, default: false }
})

const ui = useAQLConfig()

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
