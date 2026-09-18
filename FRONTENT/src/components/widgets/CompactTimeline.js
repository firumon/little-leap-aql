import { ROW_HEIGHTS } from './abstract/TimelineBase.vue'

export default {
  base: 'TimelineBase',
  props: { direction: "horizontal", markerShape: "dot", showConnector: true },
  aspect: 3,
  minHeight: ROW_HEIGHTS.compact,
  rowHeight: ROW_HEIGHTS.compact
}
