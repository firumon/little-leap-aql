import { validateConsumptionCancelDraft } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionCancel'
import { cancellability } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

// The cancellation and every ticked cascade leg stand on the live nodes from the moment the
// card mounts. Submit builds nothing: it refuses a missing reason and an audit that came to
// rest while the page was open.
const NODE = 'OutletConsumptions'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => {
  // Captured at submit: the pipeline resets pageState before navigation runs.
  let landingCode = ''

  const codeOf = () => {
    const fromPage = text(resourceRecord?.record?.value?.Code)
    if (fromPage) return fromPage
    for (const node of pageState.state.nodes.values()) {
      if (text(node?.resource) === NODE && text(node?.code)) return text(node.code)
    }
    return ''
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Consumption',
    submitColor: 'negative',

    // Abandoning goes back to the record, not `goBack()` — the user may have arrived from
    // the index. Returning `false` stops the dispatcher popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = resourceRecord?.record?.value || null
      const code = codeOf()
      if (!code) return { valid: false, message: 'This consumption could not be loaded.' }

      const gate = cancellability(row)
      if (!gate.allowed) return { valid: false, message: gate.reason }

      const problem = validateConsumptionCancelDraft(pageState.getRecord(null, NODE))
      if (problem) return { valid: false, message: problem }

      landingCode = code
    },

    // The code is carried from submit: an `update` returns none of its own, so
    // `successRoute` alone would resolve to a view route with nothing to open.
    onSubmitSuccess: (result, { nav }) => {
      if (landingCode) nav.goTo('view', { code: landingCode })
      else nav.goTo('index')
    }
  }
}
