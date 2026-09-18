import { ROW_HEIGHT } from './abstract/BarBase.vue'

export default {
  base: 'BarBase',
  props: { orientation: "horizontal", mode: "grouped", minTier: "compact" },
  minHeight: ROW_HEIGHT,
  rowHeight: ROW_HEIGHT
}
