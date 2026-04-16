/**
 * ============================================================
 * AQL - Procurement Backend Handlers
 * ============================================================
 * Handles cross-resource operations and business logic for the
 * procurement module (Purchase Requisitions, RFQs, POs, etc.).
 */

/**
 * Helper to update linked Procurement progress.
 * @param {string} procurementCode - The Procurement code to update.
 * @param {string} newProgress - The target progress to set.
 * @param {Object} auth - The auth payload of the current user.
 */
function updateProcurementProgress(procurementCode, newProgress, auth) {
    if (!procurementCode) return;

    // Find the Procurement record
    const response = handleGetRecords({
        resourceName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
        filters: JSON.stringify([{ field: 'Code', operator: 'eq', value: procurementCode }]),
        limit: 1
    }, auth);

    if (response.records && response.records.length > 0) {
        const procurement = response.records[0];

        // Check if progress actually needs to change to avoid unnecessary updates
        if (procurement.Progress !== newProgress) {
            handleUpsertRecord({
                resourceName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
                data: JSON.stringify({ Code: procurementCode, Progress: newProgress })
            }, auth);
        }
    }
}

/**
 * PostAction handler for PurchaseRequisitions.
 * Called automatically after a PR record is created or updated.
 *
 * @param {Object} payload - The original request payload.
 * @param {Object} auth - The user's auth object.
 * @param {Object} result - The result of the upsert operation (contains saved record).
 */
function handlePurchaseRequisitionPostAction(payload, auth, result) {
    if (!result.success || !result.record) return result;

    const pr = result.record;

    // Read previous state to detect transitions
    let prevProgress = 'Draft'; // Default if new record

    // If this is an update, we need the old progress to know the transition.
    // If the client sent `oldData` in the payload (ideal), we use it.
    // Otherwise, we might have to assume based on current state or just look at payload vs result.
    // Standard AQL upsert doesn't pass oldData explicitly to PostAction yet unless customized.
    // So we rely on what we know: the payload's Progress vs what is currently in DB is already saved.
    // Wait, the DB already has the new Progress.
    // The payload tells us what the user asked to change it to.

    // To properly detect transitions, we should rely on the payload providing the "from" state
    // but the safest way is if the frontend just passes `action` or `fromProgress` in payload.
    // However, we can just look at the new Progress and ensure the procurement state matches.
    // This is idempotent and safer.

    let targetProcurementProgress = null;
    let needsProcurementUpdate = false;
    let newProcurementCode = null;

    if (pr.Progress === 'New') {
        // Draft -> New (first Submit) OR Review -> New (re-confirm)
        if (!pr.ProcurementCode) {
            // First submit: Create new Procurement
            const today = new Date();
            const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

            const newProcResult = handleUpsertRecord({
                resourceName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
                data: JSON.stringify({
                    InitiatedDate: dateStr,
                    CreatedUser: auth.name,
                    CreatedRole: auth.role,
                    Status: 'Active',
                    Progress: 'INITIATED'
                })
            }, auth);

            if (newProcResult.success && newProcResult.record) {
                newProcurementCode = newProcResult.record.Code;
                // Update the PR with the new ProcurementCode
                handleUpsertRecord({
                    resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
                    data: JSON.stringify({ Code: pr.Code, ProcurementCode: newProcurementCode })
                }, auth);
            }
        }
        // If ProcurementCode exists, it's Review -> New (re-confirm), no Procurement progress change needed
    }
    else if (pr.Progress === 'Revision Required') {
        // Pending Approval -> Revision Required
        targetProcurementProgress = 'PR_CREATED';
        needsProcurementUpdate = true;
    }
    else if (pr.Progress === 'Approved') {
        // Pending Approval/Revision Required -> Approved
        targetProcurementProgress = 'PR_APPROVED';
        needsProcurementUpdate = true;
    }
    else if (pr.Progress === 'Rejected') {
        // Pending Approval/Revision Required -> Rejected
        targetProcurementProgress = 'CANCELLED';
        needsProcurementUpdate = true;
    }

    // Apply Procurement updates if needed
    if (needsProcurementUpdate && pr.ProcurementCode) {
        updateProcurementProgress(pr.ProcurementCode, targetProcurementProgress, auth);
    }

    return result;
}
