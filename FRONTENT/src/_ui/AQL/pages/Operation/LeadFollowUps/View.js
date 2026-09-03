// LeadFollowUps > View — one follow-up, the lead behind it, and how it was answered.
// `contents: []` drops the generic record grid; each section self-guards its own
// loading and empty state because sections render outside AqlContentWrapper.
export default {
  sections: ['PageHeader', 'FollowUpDetails', 'LeadDetails', 'FollowUpResponse', 'OtherFollowUps'],
  contents: [],

  permissions: {
    LeadDetails: ['Leads:read'],
    OtherFollowUps: ['LeadFollowUps:read']
  },

  PropsPageHeader: {
    title: (record) => (record?.Purpose || 'Follow Up'),
    subtitle: 'Plan, lead, response and the rest of this lead\'s follow-ups',
    reload: true
  },

  PropsFollowUpDetails: {
    title: 'Follow Up Details'
  },

  PropsLeadDetails: {
    title: 'Lead'
  },

  PropsFollowUpResponse: {
    title: 'Response'
  },

  PropsOtherFollowUps: {
    title: 'Other Follow Ups',
    limit: 6
  }
}
