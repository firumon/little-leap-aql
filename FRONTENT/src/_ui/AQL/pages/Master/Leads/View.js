// Leads > View — one lead, and the follow-up work around it.
// `contents: []` drops the generic record grid: the three cards below already say the
// same thing in the lead's own words. Sections render outside AqlContentWrapper, so each
// card carries its own loading and empty guard.
export default {
  sections: ['PageHeader', 'LeadDetails', 'UpcomingFollowUp', 'RecentFollowUps'],
  contents: [],

  permissions: {
    UpcomingFollowUp: ['LeadFollowUps:read'],
    RecentFollowUps: ['LeadFollowUps:read']
  },

  PropsPageHeader: {
    title: (record) => (record?.Name || record?.name || 'Lead'),
    subtitle: 'Lead details, next follow-up and recent follow-up history',
    reload: true
  },

  PropsLeadDetails: {
    title: 'Lead Details'
  },

  PropsUpcomingFollowUp: {
    title: 'Upcoming Follow Up'
  },

  PropsRecentFollowUps: {
    title: 'Recent Follow Ups',
    limit: 6
  }
}
