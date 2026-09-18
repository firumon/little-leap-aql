import { ROW_HEIGHT } from './abstract/BarBase.vue'

export default {
  base: 'BarBase',
  props: { orientation: "horizontal", mode: "percent100", barWidth: "thick", minTier: "compact" },
  minHeight: ROW_HEIGHT,
  rowHeight: ROW_HEIGHT
}
