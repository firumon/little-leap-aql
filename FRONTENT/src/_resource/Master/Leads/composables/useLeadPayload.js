// The only source of truth for creating a lead or moving its progress, whichever module
// triggers it. Every export returns Node Objects (UI_PAGE_STATE.md §5).

import { textOrRef } from 'src/utils/appHelpers'
import { resourceRow } from 'src/composables/resources/useResourceConfig'
import { stampFields } from 'src/utils/workflowStamp'
import { useAuth } from 'src/composables/core/useAuth'
import { DRAFT, PROCESSING, canonicalProgress, canMoveTo, canTransitionTo, isDraft, stampPrefixFor } from './useLeadProgress'
import { useLeadResource } from './useLeadResource'

const RESOURCE_NAME = 'Leads'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/** ROW builder — one sanitized sheet row. Unknown keys are dropped (§9.7). */
export function leadRow (parent = {}, extra = {}) {
  const seed = { ...asRow(parent), ...asRow(extra) }
  return resourceRow(RESOURCE_NAME, { Status: 'Active' }, seed, {
    Progress: canonicalProgress(seed.Progress) || DRAFT
  })
}

// NODE builder. The Draft seat is resolved here, never by the caller.
// Null when the lead has no name — a row nothing can act on.
export function leadNode (parent = {}, extra = {}, options = {}) {
  const record = leadRow(parent, extra)
  if (!text(record.Name)) return null

  return {
    resource: RESOURCE_NAME,
    ...(options.role ? { role: options.role } : {}),
    record,
    permissions: { create: 'You are not allowed to add a lead.' },
    reload: [RESOURCE_NAME]
  }
}

export function buildLeadCreateChainNodes ({ lead = {}, extra = {}, role = '' } = {}) {
  const node = leadNode(lead, extra, { role })
  if (!node) {
    return [{ valid: false, message: 'Enter a lead name before saving.' }]
  }
  return [{ ...node, successMsg: 'Lead added.' }]
}

// Moves a lead and writes that outcome's stamp. A plain update, not an `actions` entry:
// Leads declares no AdditionalActions yet, so GAS has no configured action to stamp from.
export function leadProgressNode (leadCode, target, { comment = '', actorName = '' } = {}) {
  const code = text(leadCode)
  const canonical = canonicalProgress(target)
  if (!code || !canonical) return null

  const { user } = useAuth()
  const actor = text(actorName) || text(user.value?.name) || text(user.value?.id)
  const prefix = stampPrefixFor(canonical)

  return {
    resource: RESOURCE_NAME,
    role: code,
    code: textOrRef(code),
    record: leadRow({
      Progress: canonical,
      ...(prefix ? stampFields(prefix, actor, comment) : {})
    }),
    permissions: { update: `You are not allowed to move this lead to ${canonical}.` },
    reload: [RESOURCE_NAME]
  }
}

// A lead starts being worked the moment the first follow-up is raised. Draft only:
// a settled or already-working lead is left where it is, and a user who cannot update
// leads gets no node rather than a denied submit.
export function leadProcessingNode (leadCode) {
  const code = text(leadCode)
  if (!code) return null

  const { leadOf } = useLeadResource()
  const lead = leadOf(code)
  if (!lead || !isDraft(lead) || !canTransitionTo(lead, PROCESSING)) return null

  return leadProgressNode(code, PROCESSING)
}

// The gate lives here so every caller refuses the same move.
export function buildLeadProgressChainNodes ({
  leadCode = '',
  lead = {},
  target = '',
  comment = '',
  actorName = ''
} = {}) {
  const canonical = canonicalProgress(target)
  if (!canonical) {
    return [{ valid: false, message: 'Choose a progress to move this lead to.' }]
  }
  if (!canMoveTo(asRow(lead), canonical)) {
    return [{ valid: false, message: `This lead cannot move to ${canonical} from where it is now.` }]
  }

  const node = leadProgressNode(leadCode, canonical, { comment, actorName })
  if (!node) {
    return [{ valid: false, message: 'This lead cannot be updated.' }]
  }
  return [{ ...node, successMsg: `Lead moved to ${canonical}.` }]
}

export function useLeadPayload () {
  return {
    leadRow,
    leadNode,
    buildLeadCreateChainNodes,
    leadProgressNode,
    leadProcessingNode,
    buildLeadProgressChainNodes
  }
}
