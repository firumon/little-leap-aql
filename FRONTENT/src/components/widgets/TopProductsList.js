import { ROW_HEIGHTS } from './abstract/RankedListBase.vue'

export default {
  base: 'RankedListBase',
  props: { rowSpacing: "tight", barStyle: "fill", showRankNumber: true },
  minHeight: ROW_HEIGHTS.tight,
  rowHeight: ROW_HEIGHTS.tight
}
