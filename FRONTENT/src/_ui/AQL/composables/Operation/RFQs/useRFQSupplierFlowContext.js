import { computed, inject, onMounted } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  supplierRowsOf,
  canAssignSuppliers,
  canMarkSuppliersSent,
  progressLabel,
  progressColor,
  supplierProgressLabel,
  supplierProgressColor,
  SUPPLIER_ASSIGNED
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

const NODE = 'RFQs'
const SELECTED = 'SelectedSupplierCodes'
const DISPATCH = 'SelectedSupplierRowCodes'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// Shared by AssignSupplier and MarkAsSent: both provide the same context and both
// resolve the RFQ summary card, so the relay sits at the resource tier.
export function useRFQSupplierFlowContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { code: routeCode } = useRouteConfig()

  const rfqs = useRecord(NODE)
  const rfqSuppliers = useRecord('RFQSuppliers')
  const suppliers = useRecord('Suppliers')
  const procurements = useRecord('Procurements')

  onMounted(() => {
    ;[rfqs, rfqSuppliers, suppliers, procurements].forEach((resource) => resource.reload())
  })

  const rfq = computed(() => {
    const code = text(routeCode?.value)
    if (!code) return null
    return rfqs.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const loading = computed(() => rfqs.loading?.value === true)
  const pending = computed(() => !rfq.value && loading.value)

  const procurement = computed(() => {
    const code = text(rfq.value?.ProcurementCode)
    if (!code) return null
    return procurements.items.value.map(asRow).find((row) => text(row.Code) === code) || null
  })

  const assignedRows = computed(() => supplierRowsOf(rfq.value, rfqSuppliers.items.value))

  const supplierIndex = computed(() => new Map(
    suppliers.items.value.map(asRow).map((row) => [text(row.Code), row])))

  const assignedDetails = computed(() => assignedRows.value.map((row) => {
    const master = supplierIndex.value.get(text(row.SupplierCode)) || {}
    return {
      code: text(row.Code),
      supplierCode: text(row.SupplierCode),
      name: text(master.Name) || text(row.SupplierCode),
      country: text(master.Country),
      contact: text(master.ContactPerson),
      sentDate: text(row.SentDate),
      progress: text(row.Progress).toUpperCase()
    }
  }))

  const dispatchable = computed(() => assignedDetails.value.filter((row) => row.progress === SUPPLIER_ASSIGNED))

  const availableSuppliers = computed(() => {
    const taken = new Set(assignedRows.value.map((row) => text(row.SupplierCode)))
    return suppliers.items.value
      .map(asRow)
      .filter((row) => isActive(row) && text(row.Code) && !taken.has(text(row.Code)))
      .map((row) => ({
        code: text(row.Code),
        name: text(row.Name) || text(row.Code),
        country: text(row.Country),
        contact: text(row.ContactPerson)
      }))
  })

  const selectedSupplierCodes = computed(() => {
    const value = pageState?.getControls(SELECTED, null, NODE)
    return Array.isArray(value) ? value : []
  })

  const selectedRowCodes = computed(() => {
    const value = pageState?.getControls(DISPATCH, null, NODE)
    return Array.isArray(value) ? value : []
  })

  function setSelectedSupplierCodes (codes) {
    pageState?.setControls(SELECTED, Array.isArray(codes) ? codes : [], NODE)
  }

  function setSelectedRowCodes (codes) {
    pageState?.setControls(DISPATCH, Array.isArray(codes) ? codes : [], NODE)
  }

  function toggleSupplier (code) {
    const next = new Set(selectedSupplierCodes.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setSelectedSupplierCodes(Array.from(next))
  }

  function toggleRow (code) {
    const next = new Set(selectedRowCodes.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setSelectedRowCodes(Array.from(next))
  }

  const canAssign = computed(() => canAssignSuppliers(rfq.value))
  const canDispatch = computed(() => canMarkSuppliersSent(rfq.value))

  return {
    pageState,
    resourceConfig,
    ui,
    user,
    rfq,
    procurement,
    loading,
    pending,
    assignedDetails,
    dispatchable,
    availableSuppliers,
    selectedSupplierCodes,
    selectedRowCodes,
    setSelectedSupplierCodes,
    setSelectedRowCodes,
    toggleSupplier,
    toggleRow,
    canAssign,
    canDispatch,
    progressLabel,
    progressColor,
    supplierProgressLabel,
    supplierProgressColor
  }
}
