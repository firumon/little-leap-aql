import { REASON_REQUIRING_COMMENT } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord, resourceConfig }) => {
  // `state.nodes` is keyed by an opaque uid, never by resource name — `useNode` is the
  // supported addressing layer, and it works outside setup.
  const node = pageState.useNode(NODE)

  const form = () => node.record.value || {}
  const stored = () => resourceRecord?.record?.value || {}

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Changes',

    cancel: (name, { nav }) => {
      nav.goTo('view', { code: text(stored().Code) })
      return false
    },

    submit: () => {
      const entry = form()

      if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
        return { valid: false, message: 'Reason "Other" needs an explanation.' }
      }

      return {
        successMsg: `Return ${text(stored().Code)} updated.`,
        // The typed form would otherwise survive the navigation and re-seed the next visit.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land back on the record, so the officer sees the corrected row and which tracks are
    // now open on it.
    successRoute: 'view'
  }
}
