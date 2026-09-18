import { ROW_HEIGHTS } from './abstract/TimelineBase.vue'

export default {
  base: 'TimelineBase',
  props: { direction: "vertical", markerShape: "dot", showConnector: true },
  minHeight: ROW_HEIGHTS.standard,
  rowHeight: ROW_HEIGHTS.standard
}
