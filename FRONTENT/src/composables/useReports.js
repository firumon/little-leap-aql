import { ref } from 'vue'
import { exportFile, useQuasar } from 'quasar'
import { callGasApi } from 'src/services/gasApi'

/**
 * useReports composable
 *
 * Provides report generation logic for master/operation pages.
 * Reads report configs from the resource's `reports` array,
 * collects user inputs via a dialog, resolves context inputs
 * from the current record, and calls the GAS backend to
 * generate a PDF which is then downloaded.
 */
export function useReports() {
  const $q = useQuasar()

  const isGenerating = ref(false)
  const showReportDialog = ref(false)
  const activeReport = ref(null)
  const reportInputs = ref({})
  const activeRecord = ref(null)

  /**
   * Get toolbar-level reports (not record-specific).
   * @param {Object} config - Resource config from auth store
   * @returns {Array} Reports where isRecordLevel !== true
   */
  function getToolbarReports(config) {
    const reports = config?.reports || []
    return reports.filter((r) => !r.isRecordLevel)
  }

  /**
   * Get record-level reports (shown per row).
   * @param {Object} config - Resource config from auth store
   * @returns {Array} Reports where isRecordLevel === true
   */
  function getRecordReports(config) {
    const reports = config?.reports || []
    return reports.filter((r) => r.isRecordLevel)
  }

  /**
   * Check if a report requires user input before generating.
   * @param {Object} report - Single report config object
   * @returns {boolean}
   */
  function requiresUserInput(report) {
    if (!report?.inputs || !Array.isArray(report.inputs)) return false
    return report.inputs.some((input) => !input.field && input.type && input.label)
  }

  /**
   * Initiate report generation.
   * If the report needs user input, opens a dialog first.
   * Otherwise, generates immediately.
   *
   * @param {Object} report - Report config from `reports` array
   * @param {Object|null} record - Current record context (for record-level reports)
   */
  function initiateReport(report, record = null) {
    activeReport.value = report
    activeRecord.value = record

    if (requiresUserInput(report)) {
      // Initialize form with defaults
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

  /**
   * Called from the dialog after user confirms inputs.
   */
  function confirmReportDialog() {
    if (!activeReport.value) return
    showReportDialog.value = false
    executeReport(activeReport.value, { ...reportInputs.value }, activeRecord.value)
  }

  /**
   * Cancel the report dialog.
   */
  function cancelReportDialog() {
    showReportDialog.value = false
    activeReport.value = null
    activeRecord.value = null
    reportInputs.value = {}
  }

  /**
   * Build cellData from report config inputs, user values, and record context.
   *
   * @param {Object} report - Report config
   * @param {Object} userValues - Values from user dialog
   * @param {Object|null} record - Row record for context inputs
   * @returns {Array} Array of { cell, value } objects
   */
  function buildCellData(report, record, userInputs) {
    const cellData = [];
    if (!report.inputs) return cellData;

    report.inputs.forEach(inp => {
      let value = '';
      const targetCell = inp.targetCell || inp.cell;

      if (inp.field) {
        // Source: Context (Record)
        value = record ? record[inp.field] : '';
      } else if (inp.type && inp.label) {
        // Source: User Input
        value = userInputs[inp.label] || inp.default || '';
      } else if (inp.default) {
        // Source: Static
        value = inp.default;
      }

      if (targetCell) {
        cellData.push({ cell: targetCell, value: value });
      }
    });

    return cellData;
  }

  /**
   * Execute report generation call to backend.
   *
   * @param {Object} report - Report config
   * @param {Object} userValues - User-provided input values
   * @param {Object|null} record - Row record context
   */
  async function executeReport(report, userValues = {}, record = null) {
    if (isGenerating.value) return

    isGenerating.value = true

    $q.notify({
      type: 'info',
      message: 'Generating report... This may take a moment.',
      icon: 'hourglass_top',
      timeout: 0,
      group: 'report-progress',
      spinner: true
    })

    try {
      const cellData = buildCellData(report, record, userValues)

      const result = await callGasApi('generateReport', {
        resource: report.resource || '',
        reportName: report.label || report.name || '',
        templateSheet: report.templateSheet || '',
        cellData
      }, {
        showLoading: false,
        showError: true
      })

      // Dismiss progress notification
      $q.notify({ group: 'report-progress' })

      if (!result.success) {
        return
      }

      // Convert Base64 to Blob and download
      const binaryString = atob(result.base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const blob = new Blob([bytes], { type: 'application/pdf' })
      const fileName = result.fileName || (report.label || report.name || 'report') + '.pdf'

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
      $q.notify({ group: 'report-progress' })
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
    // State
    isGenerating,
    showReportDialog,
    activeReport,
    reportInputs,

    // Helpers
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
