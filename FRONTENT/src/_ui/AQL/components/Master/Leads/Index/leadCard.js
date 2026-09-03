// The Leads card contract every list view starts from: name on top, place below.
// One definition, so seven views cannot drift apart on how a lead reads.

export const leadName = (lead) => lead?.Name || lead?.Code || ''

export const leadPlace = (lead) => [lead?.City, lead?.Area].filter(Boolean).join(' • ')

/** Label + place caption, plus a second caption line for the workflow comment. */
export function stampedLeadCard (commentHeader) {
  return {
    layout: ['label', 'caption', 'caption'],
    content: [leadName, leadPlace, (lead) => lead?.[commentHeader] || '']
  }
}
