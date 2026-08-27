import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnCreateNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { returnRequiresTrack, REASON_REQUIRING_COMMENT } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  const node = pageState.useNode(NODE)
  const form = () => node.record.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

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

      const result = buildReturnCreateNodes({
        form: entry,
        // The figure the form resolved and the officer may have overridden. The builder
        // records what it is handed; it never prices anything itself.
        resolvedPrice: Number(entry.Price) || 0,
        actorName: actor()
      })

      if (!result.valid) return { valid: false, message: result.message }

      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to log this return.' }
      }

      pageState.applyNodes(result.nodes)
      return {
        successMsg: result.successMsg,
        // The typed form would otherwise survive the navigation and re-seed the next visit.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land on the record just created, so the officer sees which tracks are now open and
    // can act on them immediately.
    successRoute: 'view'
  }
}
