// The only source of truth for creating a lead follow-up or answering one, whichever
// module triggers it. Every export returns Node Objects (UI_PAGE_STATE.md §5).

import { textOrRef } from 'src/utils/appHelpers'
import { toDateOnly, toDateTime24 } from 'src/utils/dateHelpers'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { stampFields } from 'src/utils/workflowStamp'
import { useAuth } from 'src/composables/core/useAuth'
import {
  AWAITING,
  COMPLETED,
  POSTPONED,
  CANCELLED,
  canonicalProgress,
  stampPrefixFor
} from './useFollowUpProgress'

const RESOURCE_NAME = 'LeadFollowUps'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * ROW builder — one sanitized sheet row, domain-complete. Unknown keys drop (§9.7).
 * The caller supplies only what a human answered; Username, Date, Progress and Status
 * are resolved here so no UI ever has to fill them in.
 */
export function followUpRow (parent = {}, extra = {}) {
  const { user } = useAuth()
  const seed = { ...asRow(parent), ...asRow(extra) }

  return resourceRow(RESOURCE_NAME, {
    Username: text(user.value?.name) || text(user.value?.id),
    Status: 'Active'
  }, seed, {
    Date: toDateOnly(text(seed.Date)) || text(seed.Date) || todayISO(),
    Progress: canonicalProgress(seed.Progress) || AWAITING
  })
}

// NODE builder. The Awaiting seat and the session user resolve here, not in the caller.
// Null when the lead is missing, unless `options.seed` — a blank form binds to a node
// before anything is picked, and `submit()` holds it to RequiredHeaders anyway.
export function followUpNode (parent = {}, extra = {}, options = {}) {
  const record = followUpRow(parent, extra)
  if (!options.seed && !text(record.LeadCode)) return null

  return {
    resource: RESOURCE_NAME,
    ...(options.role ? { role: options.role } : {}),
    record,
    permissions: { create: 'You are not allowed to add a lead follow-up.' },
    reload: [RESOURCE_NAME]
  }
}

/** The Add popup's whole submission: pick a lead and a date, the rest resolves here. */
export function buildFollowUpCreateChainNodes ({ followUp = {}, extra = {}, role = '' } = {}) {
  const entry = asRow(followUp)
  if (!text(entry.LeadCode)) {
    return [{ valid: false, message: 'Choose a lead before saving the follow-up.' }]
  }

  const node = followUpNode(entry, extra, { role })
  if (!node) {
    return [{ valid: false, message: 'This follow-up cannot be saved.' }]
  }
  return [{ ...node, successMsg: 'Follow-up added.' }]
}

// Answers an awaiting follow-up. RespondDate is stamped here rather than by GAS:
// LeadFollowUps declares no AdditionalActions, so no configured action stamps it.
export function followUpResponseNode (followUpCode, target, { comment = '', outcome = '', actorName = '' } = {}) {
  const code = text(followUpCode)
  const canonical = canonicalProgress(target)
  const prefix = stampPrefixFor(canonical)
  if (!code || !prefix) return null

  const { user } = useAuth()
  const actor = text(actorName) || text(user.value?.name) || text(user.value?.id)

  return {
    resource: RESOURCE_NAME,
    role: code,
    code: textOrRef(code),
    record: followUpRow({
      Progress: canonical,
      RespondDate: toDateTime24(new Date()),
      ...(text(outcome) ? { Outcome: text(outcome) } : {}),
      ...stampFields(prefix, actor, comment)
    }),
    permissions: { update: `You are not allowed to mark this follow-up ${canonical}.` },
    reload: [RESOURCE_NAME]
  }
}

// The successor rides as its own node under a `next` role, so both share one address.
export function buildFollowUpResponseChainNodes ({
  followUpCode = '',
  target = '',
  comment = '',
  outcome = '',
  actorName = '',
  nextFollowUp = {}
} = {}) {
  const canonical = canonicalProgress(target)
  if (!canonical) {
    return [{ valid: false, message: 'Choose how this follow-up ended.' }]
  }

  const node = followUpResponseNode(followUpCode, canonical, { comment, outcome, actorName })
  if (!node) {
    return [{ valid: false, message: 'This follow-up cannot be answered.' }]
  }

  const planned = asRow(nextFollowUp)
  const successor = text(planned.Date)
    ? followUpNode(planned, {}, { role: 'next' })
    : null

  const nodes = [node, successor].filter(Boolean)
  const last = nodes[nodes.length - 1]
  return [
    ...nodes.slice(0, -1),
    { ...last, successMsg: successor ? `Follow-up ${canonical.toLowerCase()} and the next one planned.` : `Follow-up ${canonical.toLowerCase()}.` }
  ]
}

/** Planning the next follow-up on a lead, with no answer to an earlier one. */
export function buildNextFollowUpChainNodes ({ followUp = {}, actorName = '' } = {}) {
  const entry = asRow(followUp)
  const node = followUpNode({
    ...entry,
    ...(text(actorName) ? { Username: text(actorName) } : {})
  }, {}, { role: 'next' })

  if (!node) return []
  return [{ ...node, successMsg: 'Next follow-up planned.' }]
}

/**
 * The blank node a create form binds to: every column the domain owns is already on it,
 * so the UI only ever writes the four a human answers.
 */
export function followUpSeedNode (parent = {}) {
  return followUpNode(parent, {}, { seed: true })
}

export function useFollowUpPayload () {
  return {
    AWAITING,
    COMPLETED,
    POSTPONED,
    CANCELLED,
    followUpRow,
    followUpNode,
    followUpSeedNode,
    buildFollowUpCreateChainNodes,
    followUpResponseNode,
    buildFollowUpResponseChainNodes,
    buildNextFollowUpChainNodes
  }
}
