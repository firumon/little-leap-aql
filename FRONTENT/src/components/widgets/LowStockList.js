import { ROW_HEIGHTS } from './abstract/RankedListBase.vue'

export default {
  base: 'RankedListBase',
  props: { rowSpacing: "cozy", barStyle: "capsule", showRankNumber: false },
  minHeight: ROW_HEIGHTS.cozy,
  rowHeight: ROW_HEIGHTS.cozy
}
