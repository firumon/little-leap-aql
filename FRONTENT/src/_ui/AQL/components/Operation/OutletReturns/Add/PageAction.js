import { returnRequiresTrack, REASON_REQUIRING_COMMENT } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig }) => {
  const node = pageState.useNode(NODE)
  const form = () => node.record.value || {}

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Submit Return',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    submit: () => {
      const entry = form()

      if (!returnRequiresTrack(entry)) {
        return {
          valid: false,
          message: 'A return must either be credited on an invoice or move stock off the shelf.'
        }
      }

      if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
        return { valid: false, message: 'Reason "Other" needs an explanation.' }
      }

      return {
        successMsg: 'Return logged.',
        // The typed form would otherwise survive the navigation and re-seed the next visit.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land on the record just created, so the officer sees which tracks are now open and
    // can act on them immediately.
    successRoute: 'view'
  }
}
