import { ROW_HEIGHT } from './abstract/BarBase.vue'

export default {
  base: 'BarBase',
  props: { orientation: "horizontal", mode: "single", barWidth: "thick" },
  minHeight: ROW_HEIGHT,
  rowHeight: ROW_HEIGHT
}
