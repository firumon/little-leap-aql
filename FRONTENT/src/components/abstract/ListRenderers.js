import { h, defineComponent } from 'vue'
import { QItemLabel, QChip, QBadge } from 'quasar'

const withDefaultSlot = (slots) => ({ default: () => slots.default ? slots.default() : null })

export const MainLabel = defineComponent({
  name: 'MainLabel',
  setup(props, { slots }) {
    return () => h(QItemLabel, { class: 'text-weight-bold text-subtitle2 text-grey-9' }, withDefaultSlot(slots))
  }
})

export const MainCaption = defineComponent({
  name: 'MainCaption',
  setup(props, { slots }) {
    return () => h(QItemLabel, { caption: true, class: 'text-grey-6' }, withDefaultSlot(slots))
  }
})

export const MetaLabel = defineComponent({
  name: 'MetaLabel',
  props: { color: { type: String, default: 'grey-9' } },
  setup(props, { slots }) {
    return () => h(QItemLabel, { class: `text-subtitle2 text-weight-bold text-${props.color}` }, withDefaultSlot(slots))
  }
})

export const MetaCaption = defineComponent({
  name: 'MetaCaption',
  setup(props, { slots }) {
    return () => h(QItemLabel, { caption: true, class: 'text-weight-medium text-grey-6' }, withDefaultSlot(slots))
  }
})

const metaProps = {
  color: { type: String, default: 'primary' },
  outline: { type: Boolean, default: false },
  textColor: { type: String, default: 'white' }
}

export const MetaChip = defineComponent({
  name: 'MetaChip',
  props: metaProps,
  setup(props, { slots }) {
    return () => h(QChip, {
      color: props.color,
      textColor: props.textColor,
      outline: props.outline,
      class: 'text-weight-bold',
      style: 'font-size: 0.75rem'
    }, withDefaultSlot(slots))
  }
})

export const MetaBadge = defineComponent({
  name: 'MetaBadge',
  props: metaProps,
  setup(props, { slots }) {
    return () => h(QBadge, {
      color: props.color,
      textColor: props.textColor,
      outline: props.outline,
      label: slots.default ? slots.default() : ''
    })
  }
})
