import { ref } from 'vue'
import { exportFile, useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useReports(resourceNameRef) {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()

  const isGenerating = ref(false)
  const showReportDialog = ref(false)
  const activeReport = ref(null)
  const reportInputs = ref({})
  const activeRecord = ref(null)

  function getToolbarReports(config) {
    const reports = config?.reports || []
    return reports.filter((r) => !r.isRecordLevel)
  }

  function getRecordReports(config) {
    const reports = config?.reports || []
    return reports.filter((r) => r.isRecordLevel)
  }

  function requiresUserInput(report) {
    if (!report?.inputs || !Array.isArray(report.inputs)) return false
    return report.inputs.some((input) => !input.field && input.type && input.label)
  }

  function initiateReport(report, record = null) {
    activeReport.value = report
    activeRecord.value = record

    if (requiresUserInput(report)) {
      const formInit = {}
      report.inputs
        .filter((input) => !input.field && input.type && input.label)
        .forEach((input) => {
          formInit[input.label] = input.default || ''
        })
      reportInputs.value = formInit
      showReportDialog.value = true
    } else {
      executeReport(report, {}, record)
    }
  }

  function confirmReportDialog() {
    if (!activeReport.value) return
    showReportDialog.value = false
    executeReport(activeReport.value, { ...reportInputs.value }, activeRecord.value)
  }

  function cancelReportDialog() {
    showReportDialog.value = false
    activeReport.value = null
    activeRecord.value = null
    reportInputs.value = {}
  }

  function buildCellData(report, record, userInputs) {
    const cellData = [];
    if (!report.inputs) return cellData;

    report.inputs.forEach(inp => {
      let value = '';
      const targetCell = inp.targetCell || inp.cell;

      if (inp.field) {
        value = record ? record[inp.field] : '';
      } else if (inp.type && inp.label) {
        value = userInputs[inp.label] || inp.default || '';
      } else if (inp.default) {
        value = inp.default;
      }

      if (targetCell) {
        cellData.push({ cell: targetCell, value: value });
      }
    });

    return cellData;
  }

  async function executeReport(report, userValues = {}, record = null) {
    if (isGenerating.value) return

    isGenerating.value = true

    const dismissProgress = $q.notify({
      type: 'info',
      message: 'Generating report... This may take a moment.',
      icon: 'hourglass_top',
      timeout: 0,
      spinner: true
    })

    try {
      const cellData = buildCellData(report, record, userValues)

      const resName = typeof resourceNameRef === 'function' ? resourceNameRef()
        : resourceNameRef?.value !== undefined ? resourceNameRef.value
        : (resourceNameRef || '')

      const result = await resourceIoStore.generateReportFile({
        resource: resName,
        reportName: report.label || report.name || '',
        templateSheet: report.templateSheet || '',
        cellData
      })

      dismissProgress()

      if (!result.success) {
        return
      }

      const reportData = result.data || {}
      const binaryString = atob(reportData.base64 || '')
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const blob = new Blob([bytes], { type: 'application/pdf' })
      const fileName = reportData.fileName || (report.label || report.name || 'report') + '.pdf'

      const exported = exportFile(fileName, blob, { mimeType: 'application/pdf' })

      if (exported === true) {
        $q.notify({
          type: 'positive',
          message: 'Report downloaded successfully',
          icon: 'download_done',
          timeout: 3000
        })
      } else {
        // exportFile returns a falsy value on failure (e.g. browser block)
        $q.notify({
          type: 'warning',
          message: 'Browser blocked the download. Please allow pop-ups.',
          icon: 'warning',
          timeout: 5000
        })
      }
    } catch (err) {
      dismissProgress()
      $q.notify({
        type: 'negative',
        message: 'Report generation failed: ' + (err.message || 'Unknown error'),
        timeout: 4000
      })
    } finally {
      isGenerating.value = false
      activeReport.value = null
      activeRecord.value = null
      reportInputs.value = {}
    }
  }

  return {
    isGenerating,
    showReportDialog,
    activeReport,
    reportInputs,

    getToolbarReports,
    getRecordReports,
    requiresUserInput,

    // Actions
    initiateReport,
    confirmReportDialog,
    cancelReportDialog,
    executeReport
  }
}
