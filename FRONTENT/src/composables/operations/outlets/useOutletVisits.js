import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { OUTLET_OPERATION_RESOURCES, VISIT_PROGRESS_ORDER, active, formatDate, progressMeta, sortTime, text, todayISO, visitProgress } from './outletOperationsMeta.js'
import { OUTLET_ACTIONS, executeActionRequest, failureMessage, resourceCreateRequest, responseFailed } from './outletOperationsBatch.js'

export function useOutletVisits() {
  const $q = useQuasar(); const workflowStore = useWorkflowStore(); const nav = useResourceNav()
  const visits = useResourceData(ref('OutletVisits')); const outlets = useResourceData(ref('Outlets')); const rules = useResourceData(ref('OutletOperatingRules'))
  const loading = ref(false); const saving = ref(false); const searchTerm = ref(''); const form = ref({ Progress: 'PLANNED', ProgressPlannedComment: '', Status: 'Active', Date: todayISO() })
  const matchesSearch = row => !searchTerm.value || outletLabel(row.OutletCode).toLowerCase().includes(searchTerm.value.toLowerCase())
  const items = computed(() => visits.items.value.filter(active).filter(row => VISIT_PROGRESS_ORDER.includes(visitProgress(row))).filter(matchesSearch))
  const searchedVisits = computed(() => visits.items.value.filter(row => VISIT_PROGRESS_ORDER.includes(visitProgress(row))).filter(matchesSearch))
  const activeVisits = computed(() => searchedVisits.value.filter(active).filter(row => visitProgress(row) === 'PLANNED').sort(compareVisitDateAsc))
  const overdueVisits = computed(() => activeVisits.value.filter(row => visitDateBucket(row) === 'overdue'))
  const todayVisits = computed(() => activeVisits.value.filter(row => visitDateBucket(row) === 'today'))
  const thisWeekVisits = computed(() => activeVisits.value.filter(row => visitDateBucket(row) === 'thisWeek'))
  const futureVisits = computed(() => activeVisits.value.filter(row => visitDateBucket(row) === 'future'))
  const upcomingSections = computed(() => [
    { key: 'overdue', label: 'Overdue', tone: 'negative', items: overdueVisits.value },
    { key: 'today', label: 'Today', tone: 'primary', items: todayVisits.value },
    { key: 'thisWeek', label: 'This Week', tone: 'grey', items: thisWeekVisits.value },
    { key: 'future', label: 'Future', tone: 'grey', items: futureVisits.value }
  ])
  const historyVisits = computed(() => searchedVisits.value.filter(row => ['COMPLETED', 'POSTPONED', 'CANCELLED'].includes(visitProgress(row))).sort(compareVisitDateDesc))
  const groups = computed(() => VISIT_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: items.value.filter(row => (VISIT_PROGRESS_ORDER.includes(visitProgress(row)) ? visitProgress(row) : 'OTHER') === key).sort((a, b) => sortTime(b) - sortTime(a)) })).filter(group => group.items.length))
  const outletOptions = computed(() => outlets.items.value.filter(active).map(row => ({ label: `${row.Code} · ${row.Name}`, value: row.Code })))
  function parseDateOnly(value) { const raw = text(value).slice(0, 10); const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) return null; const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])); return Number.isNaN(date.getTime()) ? null : date }
  function startOfToday() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
  function visitDate(row = {}) { return parseDateOnly(row.Date || row.ScheduledAt) }
  function daysFromToday(row = {}) { const date = visitDate(row); if (!date) return null; return Math.round((date.getTime() - startOfToday().getTime()) / 86400000) }
  function isPlannedActiveVisit(row = {}) { return active(row) && visitProgress(row) === 'PLANNED' }
  function visitDateBucket(row = {}) { if (!isPlannedActiveVisit(row)) return 'future'; const days = daysFromToday(row); if (days == null) return 'future'; if (days < 0) return 'overdue'; if (days === 0) return 'today'; if (days <= 7) return 'thisWeek'; return 'future' }
  function visitDateLabel(row = {}) { const formatted = formatDate(row.Date || row.ScheduledAt); if (!isPlannedActiveVisit(row)) return formatted || 'No date'; const days = daysFromToday(row); if (days == null) return formatted || 'No date'; if (days < 0) return `Due ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`; if (days === 0) return 'Today'; if (days <= 7) return `in ${days} ${days === 1 ? 'day' : 'days'}`; return formatted }
  function visitUrgency(row = {}) { const bucket = visitDateBucket(row); if (bucket === 'overdue') return 'overdue'; if (bucket === 'today') return 'today'; return 'neutral' }
  function compareVisitDateAsc(a, b) { const at = visitDate(a)?.getTime() || Number.MAX_SAFE_INTEGER; const bt = visitDate(b)?.getTime() || Number.MAX_SAFE_INTEGER; return at - bt || text(a.Code).localeCompare(text(b.Code)) }
  function compareVisitDateDesc(a, b) { const at = visitDate(a)?.getTime() || 0; const bt = visitDate(b)?.getTime() || 0; return bt - at || text(a.Code).localeCompare(text(b.Code)) }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function visitDateDisplay(row = {}) {
    const formatted = formatDate(row.Date || row.ScheduledAt)
    const isPlanned = isPlannedActiveVisit(row)
    const days = daysFromToday(row)
    const urgency = !isPlanned ? 'neutral' : days == null ? 'future' : days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'thisWeek' : 'future'
    const date = visitDate(row)
    const absDate = date ? `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` : formatted
    if (!isPlanned || days == null) return { relative: '', absolute: formatted || 'No date', urgency }
    if (days < 0) return { relative: `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`, absolute: `Planned ${absDate}`, urgency }
    if (days === 0) return { relative: 'Today', absolute: `Planned ${absDate}`, urgency }
    if (days === 1) return { relative: 'Tomorrow', absolute: absDate, urgency }
    if (days <= 7) return { relative: `in ${days} days`, absolute: absDate, urgency }
    return { relative: '', absolute: absDate, urgency }
  }

  const summaryStats = computed(() => {
    const overdue = overdueVisits.value.length
    const today = todayVisits.value.length
    const thisWeek = thisWeekVisits.value.length
    const future = futureVisits.value.length
    return { overdue, today, thisWeek, future, total: overdue + today + thisWeek + future }
  })

  const outletsWithoutVisits = computed(() => {
    const plannedCodes = new Set(activeVisits.value.map(v => text(v.OutletCode)))
    return outlets.items.value.filter(active).filter(o => !plannedCodes.has(text(o.Code)))
  })

  const upcomingByDate = computed(() => {
    const grouped = {}
    for (const visit of activeVisits.value) {
      const key = formatDate(visit.Date || visit.ScheduledAt)
      if (!key) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(visit)
    }
    return Object.entries(grouped)
      .map(([date, items]) => {
        const d = parseDateOnly(date)
        let label = date
        if (d) {
          const daysDiff = Math.round((d.getTime() - startOfToday().getTime()) / 86400000)
          if (daysDiff === 0) label = 'Today'
          else if (daysDiff === 1) label = 'Tomorrow'
          else label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
        }
        return { date, label, items }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  })

  const historyByMonth = computed(() => {
    const grouped = {}
    for (const visit of historyVisits.value) {
      const key = formatDate(visit.Date || visit.ScheduledAt).slice(0, 7)
      if (!key || key.length < 7) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(visit)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => {
        const parts = month.split('-')
        const label = `${MONTH_NAMES[Number(parts[1]) - 1]} ${parts[0]}`
        return { month, label, items }
      })
  })

  const historyStatusFilter = ref('')
  const historyDateFrom = ref('')
  const historyDateTo = ref('')

  const filteredHistoryVisits = computed(() => {
    let result = historyVisits.value
    if (historyStatusFilter.value) {
      result = result.filter(v => visitProgress(v) === historyStatusFilter.value.toUpperCase())
    }
    if (historyDateFrom.value) {
      result = result.filter(v => {
        const d = formatDate(v.Date || v.ScheduledAt)
        return d && d >= historyDateFrom.value
      })
    }
    if (historyDateTo.value) {
      result = result.filter(v => {
        const d = formatDate(v.Date || v.ScheduledAt)
        return d && d <= historyDateTo.value
      })
    }
    return result
  })

  const filteredHistoryByMonth = computed(() => {
    const grouped = {}
    for (const visit of filteredHistoryVisits.value) {
      const key = formatDate(visit.Date || visit.ScheduledAt).slice(0, 7)
      if (!key || key.length < 7) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(visit)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => {
        const parts = month.split('-')
        const label = `${MONTH_NAMES[Number(parts[1]) - 1]} ${parts[0]}`
        return { month, label, items }
      })
  })

  async function planVisit(outletCode, date, comment = '') { if (!text(outletCode) || !text(date)) { $q.notify({ type: 'warning', message: 'Outlet and date are required.', position: 'top' }); return false } saving.value = true; try { const result = await workflowStore.createResourceRecord('OutletVisits', { OutletCode: text(outletCode), Date: text(date), Progress: 'PLANNED', ProgressPlannedComment: text(comment), Status: 'Active' }); if (!result?.success) { $q.notify({ type: 'negative', message: result?.error || result?.message || 'Failed to create visit.', position: 'top' }); return false } $q.notify({ type: 'positive', message: 'Visit planned.', position: 'top' }); return true } finally { saving.value = false } }
  async function reload(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(OUTLET_OPERATION_RESOURCES, { forceSync }) } finally { loading.value = false } }
  async function reloadIndex(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletVisits', 'Outlets'], { forceSync }) } finally { loading.value = false } }
  function addDaysISO(dateValue, days) { const base = text(dateValue) ? new Date(text(dateValue)) : new Date(); if (Number.isNaN(base.getTime())) base.setTime(Date.now()); base.setDate(base.getDate() + (Number(days) || 0)); return base.toISOString().slice(0, 10) }
  function visitFrequencyDays(outletCode) { const rule = rules.items.value.find(row => active(row) && text(row.OutletCode) === text(outletCode)); const days = Number(rule?.VisitFrequencyDays); return Number.isFinite(days) && days > 0 ? days : 14 }
  function plannedVisitRequest(visit, date, comment = '') { return resourceCreateRequest('OutletVisits', { OutletCode: text(visit?.OutletCode), Date: text(date), Progress: 'PLANNED', ProgressPlannedComment: text(comment), Status: 'Active' }) }
  async function createVisit() { if (!text(form.value.OutletCode) || !text(form.value.Date)) return $q.notify({ type: 'warning', message: 'Outlet and date are required.', position: 'top' }); saving.value = true; try { const result = await workflowStore.createResourceRecord('OutletVisits', { OutletCode: text(form.value.OutletCode), Date: text(form.value.Date), Progress: 'PLANNED', ProgressPlannedComment: text(form.value.ProgressPlannedComment), Status: 'Active' }); if (!result?.success) return $q.notify({ type: 'negative', message: result?.error || result?.message || 'Failed to create visit.', position: 'top' }); $q.notify({ type: 'positive', message: 'Visit planned.', position: 'top' }); nav.goTo('list') } finally { saving.value = false } }
  async function completeVisit(visit, fields = {}) { if (visitProgress(visit) !== 'PLANNED') { $q.notify({ type: 'warning', message: 'Only planned visits can be completed.', position: 'top' }); return false } saving.value = true; try { const nextDate = addDaysISO(visit.Date, visitFrequencyDays(visit.OutletCode)); const result = await workflowStore.runBatchRequests([executeActionRequest('OutletVisits', visit.Code, OUTLET_ACTIONS.completeVisit, { ProgressCompletedComment: text(fields.ProgressCompletedComment || fields.StatusCompletedComment || fields.StatusComment || fields.Comment) }), plannedVisitRequest(visit, nextDate, 'Auto planned after completed visit')]); if (responseFailed(result)) { $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to complete visit.'), position: 'top' }); return false } $q.notify({ type: 'positive', message: 'Visit completed and next visit planned.', position: 'top' }); return true } finally { saving.value = false } }
  async function postponeVisit(visit, fields = {}) { if (!text(fields.ProgressPostponedComment || fields.StatusPostponedComment || fields.StatusComment || fields.Comment) || !text(fields.Date)) { $q.notify({ type: 'warning', message: 'Reason and new date are required.', position: 'top' }); return false } saving.value = true; try { const create = { OutletCode: visit.OutletCode, Date: text(fields.Date), Progress: 'PLANNED', ProgressPlannedComment: '', Status: 'Active' }; const result = await workflowStore.runBatchRequests([executeActionRequest('OutletVisits', visit.Code, OUTLET_ACTIONS.postponeVisit, { ProgressPostponedComment: text(fields.ProgressPostponedComment || fields.StatusPostponedComment || fields.StatusComment || fields.Comment) }), resourceCreateRequest('OutletVisits', create)]); if (responseFailed(result)) { $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to postpone visit.'), position: 'top' }); return false } $q.notify({ type: 'positive', message: 'Visit postponed.', position: 'top' }); return true } finally { saving.value = false } }
  async function cancelVisit(visit, fields = {}) { const reason = text(fields.ProgressCancelledComment || fields.StatusCancelledComment || fields.StatusComment || fields.Comment || fields.reason || fields); if (!reason) { $q.notify({ type: 'warning', message: 'Cancellation reason is required.', position: 'top' }); return false } saving.value = true; try { const requests = [executeActionRequest('OutletVisits', visit.Code, OUTLET_ACTIONS.cancelVisit, { ProgressCancelledComment: reason })]; if (text(fields.Date || fields.nextDate)) requests.push(plannedVisitRequest(visit, text(fields.Date || fields.nextDate), 'Auto planned after cancelled visit')); const result = requests.length === 1 ? await workflowStore.executeResourceAction('OutletVisits', visit.Code, OUTLET_ACTIONS.cancelVisit, { ProgressCancelledComment: reason }) : await workflowStore.runBatchRequests(requests); if (requests.length === 1 ? !result?.success : responseFailed(result)) { $q.notify({ type: 'negative', message: requests.length === 1 ? (result?.error || result?.message || 'Failed to cancel visit.') : failureMessage(result, 'Failed to cancel visit.'), position: 'top' }); return false } $q.notify({ type: 'positive', message: text(fields.Date || fields.nextDate) ? 'Visit cancelled and next visit planned.' : 'Visit cancelled.', position: 'top' }); return true } finally { saving.value = false } }
  function getVisit(code) { return visits.items.value.find(row => row.Code === code) || null } function outletLabel(code) { const row = outlets.items.value.find(item => item.Code === code); return row ? text(row.Name) || code : code } function navigateTo(code) { nav.goTo('view', { code }) } function navigateToAdd() { nav.goTo('add') } function cancel() { nav.goTo('list') }
  return { loading, saving, searchTerm, form, items, groups, searchedVisits, activeVisits, overdueVisits, todayVisits, thisWeekVisits, futureVisits, upcomingSections, historyVisits, outletOptions, reload, reloadIndex, createVisit, planVisit, completeVisit, postponeVisit, cancelVisit, getVisit, outletLabel, progressMeta, visitDateBucket, visitDateLabel, visitUrgency, visitProgress, navigateTo, navigateToAdd, cancel, summaryStats, outletsWithoutVisits, upcomingByDate, historyByMonth, historyStatusFilter, historyDateFrom, historyDateTo, filteredHistoryVisits, filteredHistoryByMonth, visitDateDisplay }
}
