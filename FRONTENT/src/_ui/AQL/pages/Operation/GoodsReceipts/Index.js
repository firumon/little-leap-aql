import {
  activePreset,
  invalidatedPreset
} from 'src/_ui/AQL/composables/Operation/GoodsReceipts/Index/useGoodsReceiptRowPresets'

// A GRN register is a history list, so it carries no work queues or ageing bands.
export default {
  sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsListActive: (props) => activePreset(props.items),
  PropsListInvalidated: (props) => invalidatedPreset(props.items)
}
