/**
 * ============================================================
 * AQL - OPERATION Sheet Setup (Resources Driven)
 * ============================================================
 * Run this function in APP Apps Script project only.
 * It reads APP.Resources, opens target files by FileID,
 * and creates/updates configured OPERATION sheets there.
 *
 * Shared helpers: setupSheetUtils.gs (setup_* functions)
 */

var OPERATION_HEADER_COLOR = '#2E7D32';
var OPERATION_ALT_ROW_COLOR = '#f0f7f1';

function setup_getOperationSchemas() {
    const commonAuditColumns = ['CreatedAt', 'UpdatedAt', 'Revision', 'CreatedBy', 'UpdatedBy'];

    return [
        {
            resourceName: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
            headers: ['Code', 'Progress', 'InitiatedDate', 'CreatedUser', 'CreatedRole', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'INITIATED' },
            columnWidths: { Code: 150, Progress: 180, InitiatedDate: 150, CreatedUser: 150, CreatedRole: 150, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
            headers: ['Code', 'ProcurementCode', 'PRDate', 'Type', 'Priority', 'RequiredDate', 'WarehouseCode', 'TypeReferenceCode', 'Progress',
                      'ProgressRevisionRequiredAt', 'ProgressRevisionRequiredBy', 'ProgressRevisionRequiredComment',
                      'ProgressApprovedAt', 'ProgressApprovedBy', 'ProgressApprovedComment',
                      'ProgressRejectedAt', 'ProgressRejectedBy', 'ProgressRejectedComment',
                      'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'Draft' },
            columnWidths: {
                Code: 150, ProcurementCode: 150, PRDate: 130, Type: 100, Priority: 100,
                RequiredDate: 130, WarehouseCode: 140, TypeReferenceCode: 160, Progress: 130,
                ProgressRevisionRequiredAt: 160, ProgressRevisionRequiredBy: 150, ProgressRevisionRequiredComment: 200,
                ProgressApprovedAt: 160, ProgressApprovedBy: 150, ProgressApprovedComment: 200,
                ProgressRejectedAt: 160, ProgressRejectedBy: 150, ProgressRejectedComment: 200,
                Status: 100, AccessRegion: 130
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
            headers: ['Code','PurchaseRequisitionCode', 'SKU', 'UOM', 'Quantity', 'EstimatedRate'],
            defaults: { Quantity: 0, EstimatedRate: 0 },
            columnWidths: { Code: 150, PurchaseRequisitionCode: 200, SKU: 150, UOM: 100, Quantity: 100, EstimatedRate: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.RFQS,
            headers: ['Code', 'ProcurementCode','PurchaseRequisitionCode','PurchaseRequisitionItemsCode','RFQDate','LeadTimeDays','LeadTimeType','ShippingTermMode','ShippingTerm','PaymentTermMode','PaymentTerm','PaymentTermDetail','QuotationValidityDays','QuotationValidityMode','DeliveryMode','AllowPartialDelivery','AllowSplitShipment','SubmissionDeadline','Progress',
                'ProgressClosedComment', 'ProgressClosedAt', 'ProgressClosedBy',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'DRAFT' },
            columnWidths: { Code: 150, ProcurementCode: 150, PurchaseRequisitionCode: 120,
            PurchaseRequisitionItemsCode: 120, RFQDate: 120, LeadTimeDays: 120, LeadTimeType: 120,
            ShippingTermMode: 120, ShippingTerm: 120, PaymentTermMode: 120, PaymentTerm: 120, PaymentTermDetail: 120,
            QuotationValidityDays: 120, QuotationValidityMode: 120, DeliveryMode: 120, AllowPartialDelivery: 120,
            AllowSplitShipment: 120, SubmissionDeadline: 120, Progress: 120,
            ProgressClosedComment: 220, ProgressClosedAt: 160, ProgressClosedBy: 150,
            Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.RFQ_SUPPLIERS,
            headers: ['Code', 'ProcurementCode', 'RFQCode', 'SupplierCode', 'SentDate', 'Progress', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'ASSIGNED' },
            columnWidths: { Code: 150, ProcurementCode: 150, RFQCode: 150, SupplierCode: 150, SentDate: 150,
            Progress: 150, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATIONS,
            headers: ['Code', 'ProcurementCode', 'RFQCode', 'SupplierCode', 'ResponseType', 'ResponseDate', 'DeclineReason',
                'AllowPartialPO', 'SupplierQuotationReference',
                'LeadTimeDays', 'LeadTimeType', 'DeliveryMode', 'AllowPartialDelivery', 'AllowSplitShipment',
                'ShippingTerm', 'PaymentTerm', 'PaymentTermDetail', 'QuotationValidityDays', 'ValidUntilDate',
                'Currency', 'TotalAmount', 'ExtraChargesBreakup', 'Remarks', 'Progress',
                'ProgressRejectedComment', 'ProgressRejectedAt', 'ProgressRejectedBy',
                'ResponseRecordedAt', 'ResponseRecordedBy', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'RECEIVED', TotalAmount: 0, Currency: 'AED', ExtraChargesBreakup: '{"tax":0,"freight":0,"commission":0,"handling":0,"other":0}', AllowPartialPO: 'TRUE' },
            columnWidths: {
                Code: 150, ProcurementCode: 150, RFQCode: 150, SupplierCode: 150, ResponseType: 130,
                ResponseDate: 130, DeclineReason: 220, AllowPartialPO: 120, SupplierQuotationReference: 150, LeadTimeDays: 120, LeadTimeType: 130,
                DeliveryMode: 130, AllowPartialDelivery: 150, AllowSplitShipment: 150,
                ShippingTerm: 120, PaymentTerm: 130, PaymentTermDetail: 220,
                QuotationValidityDays: 160, ValidUntilDate: 130, Currency: 100, TotalAmount: 130,
                ExtraChargesBreakup: 260, Remarks: 240, Progress: 130,
                ProgressRejectedComment: 220, ProgressRejectedAt: 160, ProgressRejectedBy: 150,
                ResponseRecordedAt: 160, ResponseRecordedBy: 150, Status: 100, AccessRegion: 130
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.SUPPLIER_QUOTATION_ITEMS,
            headers: ['Code', 'SupplierQuotationCode', 'PurchaseRequisitionItemCode', 'SKU', 'Description',
                'Quantity', 'UnitPrice', 'TotalPrice', 'LeadTimeDays', 'DeliveryDate', 'Remarks', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0, UnitPrice: 0, TotalPrice: 0 },
            columnWidths: {
                Code: 150, SupplierQuotationCode: 180, PurchaseRequisitionItemCode: 220, SKU: 150,
                Description: 240, Quantity: 100, UnitPrice: 100, TotalPrice: 120,
                LeadTimeDays: 120, DeliveryDate: 130, Remarks: 220, Status: 100
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDERS,
            headers: ['Code', 'ProcurementCode', 'SupplierQuotationCode', 'SupplierCode', 'PODate', 'ShipToWarehouseCode', 'Progress',
                      'ProgressSentAt', 'ProgressSentBy', 'ProgressSentComment',
                      'ProgressAcknowledgedAt', 'ProgressAcknowledgedBy', 'ProgressAcknowledgedComment',
                      'ProgressAcceptedAt', 'ProgressAcceptedBy', 'ProgressAcceptedComment',
                      'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                      'Currency', 'SubtotalAmount', 'ExtraChargesBreakup', 'TotalAmount', 'Remarks', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'CREATED', Currency: 'AED', SubtotalAmount: 0, TotalAmount: 0, ExtraChargesBreakup: '{"tax":0,"freight":0,"commission":0,"handling":0,"other":0}' },
            columnWidths: { Code: 150, ProcurementCode: 150, SupplierQuotationCode: 150, SupplierCode: 150, PODate: 130, ShipToWarehouseCode: 140, Progress: 180,
                            ProgressSentAt: 160, ProgressSentBy: 150, ProgressSentComment: 200,
                            ProgressAcknowledgedAt: 160, ProgressAcknowledgedBy: 150, ProgressAcknowledgedComment: 200,
                            ProgressAcceptedAt: 160, ProgressAcceptedBy: 150, ProgressAcceptedComment: 200,
                            ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 200,
                            Currency: 100, SubtotalAmount: 130, ExtraChargesBreakup: 260, TotalAmount: 130, Remarks: 240, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_ORDER_ITEMS,
            headers: ['Code', 'PurchaseOrderCode', 'SupplierQuotationItemCode', 'SKU', 'Description', 'UOM', 'QuotedQuantity', 'OrderedQuantity', 'UnitPrice', 'SupplierItemCode', 'Remarks', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', QuotedQuantity: 0, OrderedQuantity: 0, UnitPrice: 0 },
            columnWidths: { Code: 150, PurchaseOrderCode: 150, SupplierQuotationItemCode: 150, SKU: 150, Description: 240, UOM: 100, QuotedQuantity: 100, OrderedQuantity: 100, UnitPrice: 100, SupplierItemCode: 150, Remarks: 220, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PO_RECEIVINGS,
            headers: ['Code', 'ProcurementCode', 'PurchaseOrderCode', 'InspectionDate', 'InspectedUserName', 'Progress',
                       'ProgressConfirmedAt', 'ProgressConfirmedBy', 'ProgressConfirmedComment',
                       'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                       'ProgressGRNGeneratedAt', 'ProgressGRNGeneratedBy', 'ProgressGRNGeneratedComment',
                       'Remarks', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'DRAFT' },
            columnWidths: { Code: 150, ProcurementCode: 150, PurchaseOrderCode: 150, InspectionDate: 130, InspectedUserName: 180, Progress: 150,
                            ProgressConfirmedAt: 160, ProgressConfirmedBy: 150, ProgressConfirmedComment: 220,
                            ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 220,
                            ProgressGRNGeneratedAt: 170, ProgressGRNGeneratedBy: 160, ProgressGRNGeneratedComment: 230,
                            Remarks: 240, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.PO_RECEIVING_ITEMS,
            headers: ['Code', 'POReceivingCode', 'PurchaseOrderItemCode', 'SKU', 'ExpectedQty', 'ReceivedQty', 'DamagedQty', 'RejectedQty', 'RejectedReason', 'Remarks', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', ReceivedQty: 0, DamagedQty: 0, RejectedQty: 0 },
            columnWidths: { Code: 150, POReceivingCode: 150, PurchaseOrderItemCode: 180, SKU: 150, ExpectedQty: 120, ReceivedQty: 120, DamagedQty: 120, RejectedQty: 120, RejectedReason: 220, Remarks: 220, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPTS,
            headers: ['Code', 'ProcurementCode', 'PurchaseOrderCode', 'POReceivingCode', 'Date', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active' },
            columnWidths: { Code: 150, ProcurementCode: 150, PurchaseOrderCode: 150, POReceivingCode: 150, Date: 130, Status: 100, AccessRegion: 130, CreatedAt: 170, UpdatedAt: 170, Revision: 100, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.GOODS_RECEIPT_ITEMS,
            headers: ['Code', 'GoodsReceiptCode', 'POReceivingItemCode', 'SKU', 'Qty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active' },
            columnWidths: { Code: 150, GoodsReceiptCode: 160, POReceivingItemCode: 180, SKU: 150, Qty: 120, Status: 100, CreatedAt: 170, UpdatedAt: 170, Revision: 100, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.STOCK_MOVEMENTS,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'QtyChange', 'ReferenceType', 'ReferenceCode', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', QtyChange: 0 },
            columnWidths: { Code: 150, WarehouseCode: 130, StorageName: 130, SKU: 150, QtyChange: 120, ReferenceType: 140, ReferenceCode: 150, Status: 100, AccessRegion: 130, CreatedAt: 170, UpdatedAt: 170, Revision: 100, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.WAREHOUSE_STORAGES,
            headers: ['Code', 'WarehouseCode', 'StorageName', 'SKU', 'Quantity'].concat(commonAuditColumns),
            defaults: { Quantity: 0 },
            columnWidths: { Code: 150, WarehouseCode: 150, StorageName: 200, SKU: 150, Quantity: 120, CreatedAt: 170, UpdatedAt: 170, Revision: 100, CreatedBy: 140, UpdatedBy: 140 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_VISITS,
            headers: ['Code', 'OutletCode', 'Date', 'RespondDate', 'Progress',
                'ProgressPlannedAt', 'ProgressPlannedBy', 'ProgressPlannedComment',
                'ProgressCompletedAt', 'ProgressCompletedBy', 'ProgressCompletedComment',
                'ProgressPostponedAt', 'ProgressPostponedBy', 'ProgressPostponedComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Progress: 'PLANNED' },
            columnWidths: { Code: 150, OutletCode: 140, Date: 130, RespondDate: 170, Progress: 140,
                ProgressPlannedAt: 160, ProgressPlannedBy: 150, ProgressPlannedComment: 220,
                ProgressCompletedAt: 160, ProgressCompletedBy: 150, ProgressCompletedComment: 220,
                ProgressPostponedAt: 160, ProgressPostponedBy: 150, ProgressPostponedComment: 220,
                ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 220,
                Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCKS,
            headers: ['Code', 'Date', 'OutletCode', 'OutletConsumptionCode', 'RequestedUser', 'ApprovedUser', 'Progress',
                'ProgressSubmittedAt', 'ProgressSubmittedBy', 'ProgressSubmittedComment',
                'ProgressRevisionRequiredAt', 'ProgressRevisionRequiredBy', 'ProgressRevisionRequiredComment',
                'ProgressApprovedAt', 'ProgressApprovedBy', 'ProgressApprovedComment',
                'ProgressRejectedAt', 'ProgressRejectedBy', 'ProgressRejectedComment',
                'ProgressDeliveredAt', 'ProgressDeliveredBy', 'ProgressDeliveredComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Progress: 'DRAFT' },
            columnWidths: { Code: 150, Date: 130, OutletCode: 140, OutletConsumptionCode: 180, RequestedUser: 180, ApprovedUser: 180, Progress: 180,
                ProgressSubmittedAt: 160, ProgressSubmittedBy: 150, ProgressSubmittedComment: 220,
                ProgressRevisionRequiredAt: 170, ProgressRevisionRequiredBy: 170, ProgressRevisionRequiredComment: 240,
                ProgressApprovedAt: 160, ProgressApprovedBy: 150, ProgressApprovedComment: 220,
                ProgressRejectedAt: 160, ProgressRejectedBy: 150, ProgressRejectedComment: 220,
                ProgressDeliveredAt: 170, ProgressDeliveredBy: 170, ProgressDeliveredComment: 220,
                ProgressCancelledAt: 170, ProgressCancelledBy: 170, ProgressCancelledComment: 220,
                Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_RESTOCK_ITEMS,
            headers: ['Code', 'OutletRestockCode', 'WarehouseCode', 'SKU', 'StorageName', 'Quantity', 'Progress',
                'ProgressAllocatedAt', 'ProgressAllocatedBy', 'ProgressAllocatedComment',
                'ProgressDeliveredAt', 'ProgressDeliveredBy', 'ProgressDeliveredComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Quantity: 0, Progress: 'PENDING' },
            columnWidths: { Code: 150, OutletRestockCode: 170, WarehouseCode: 150, SKU: 150, StorageName: 170, Quantity: 130, Progress: 140,
                ProgressAllocatedAt: 170, ProgressAllocatedBy: 170, ProgressAllocatedComment: 220,
                ProgressDeliveredAt: 170, ProgressDeliveredBy: 170, ProgressDeliveredComment: 220,
                ProgressCancelledAt: 170, ProgressCancelledBy: 170, ProgressCancelledComment: 220,
                Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_DELIVERIES,
            headers: [
                'Code', 'Date', 'UserName', 'Progress', 'OutletRestockItemCodes',
                'ProgressInTransitAt', 'ProgressInTransitBy', 'ProgressInTransitComment',
                'ProgressCompletedAt', 'ProgressCompletedBy', 'ProgressCompletedComment',
                'CancelledAt', 'CancelledBy', 'CancelledComment',
                'Status', 'AccessRegion'
            ].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Progress: 'DRAFT' },
            columnWidths: { Code: 150, Date: 130, UserName: 180, Progress: 140, OutletRestockItemCodes: 300,
                ProgressInTransitAt: 170, ProgressInTransitBy: 170, ProgressInTransitComment: 240,
                ProgressCompletedAt: 170, ProgressCompletedBy: 170, ProgressCompletedComment: 240,
                CancelledAt: 170, CancelledBy: 170, CancelledComment: 240, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_RETURNS,
            headers: [
                'Code', 'OutletCode', 'Date', 'Username', 'SKU', 'Qty', 'Price', 'Reason', 'ReasonComment',
                'InvoiceAdjustmentRequired', 'InvoiceAdjustmentDone', 'ConsumptionInvoiceCode',
                // The bill it was SOLD on — `ConsumptionInvoiceCode` is the one that SETTLES it.
                'SourceInvoiceCode',
                'WarehouseActionRequired', 'WarehouseActionCompleted', 'WarehouseCode',
                'WarehouseAction', 'WarehouseActionDisposedReason',
                'WarehouseActionDisposedAt', 'WarehouseActionDisposedBy',
                'WarehouseActionStockedAt', 'WarehouseActionStockedBy',
                'Progress', 'Status', 'AccessRegion'
            ].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Qty: 0, Price: 0, Progress: 'SUBMITTED', InvoiceAdjustmentRequired: 'FALSE', InvoiceAdjustmentDone: 'FALSE', WarehouseActionRequired: 'FALSE', WarehouseActionCompleted: 'FALSE', WarehouseAction: '', WarehouseActionDisposedReason: '', ConsumptionInvoiceCode: '', SourceInvoiceCode: '' },
            columnWidths: {
                Code: 150, OutletCode: 140, Date: 130, Username: 170, SKU: 150, Qty: 100, Price: 120,
                Reason: 140, ReasonComment: 200,
                InvoiceAdjustmentRequired: 160, InvoiceAdjustmentDone: 150, ConsumptionInvoiceCode: 200,
                SourceInvoiceCode: 200,
                WarehouseActionRequired: 160, WarehouseActionCompleted: 150,
                WarehouseCode: 140, WarehouseAction: 150, WarehouseActionDisposedReason: 200,
                WarehouseActionDisposedAt: 160, WarehouseActionDisposedBy: 150,
                WarehouseActionStockedAt: 160, WarehouseActionStockedBy: 150,
                Progress: 140, Status: 100, AccessRegion: 130
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTIONS,
            headers: ['Code', 'OutletCode', 'Date', 'Username', 'OutletVisitCode', 'Progress',
                'ProgressPendingInvoiceGenerationAt', 'ProgressPendingInvoiceGenerationBy', 'ProgressPendingInvoiceGenerationComment',
                'ProgressInvoiceGeneratedAt', 'ProgressInvoiceGeneratedBy', 'ProgressInvoiceGeneratedComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Progress: 'PENDING_INVOICE_GENERATION' },
            columnWidths: { Code: 150, OutletCode: 140, Date: 140, Username: 170, OutletVisitCode: 170, Progress: 180, ProgressPendingInvoiceGenerationAt: 190, ProgressPendingInvoiceGenerationBy: 190, ProgressPendingInvoiceGenerationComment: 240, ProgressInvoiceGeneratedAt: 170, ProgressInvoiceGeneratedBy: 170, ProgressInvoiceGeneratedComment: 220, ProgressCancelledAt: 160, ProgressCancelledBy: 160, ProgressCancelledComment: 220, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_ITEMS,
            headers: ['Code', 'OutletConsumptionCode', 'SKU', 'Qty', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Qty: 0 },
            columnWidths: { Code: 150, OutletConsumptionCode: 190, SKU: 150, Qty: 130, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICES,
            headers: ['Code', 'OutletConsumptionCode', 'Date', 'DueDate', 'OutletCode', 'Username', 'PriceListCode', 'Subtotal', 'Discount', 'TotalTaxableAmount', 'TotalTaxAmount', 'TaxDetails', 'OutletReturnCodes', 'ReturnDeductionTotal', 'SettlementMismatchAmount', 'SettlementReason', 'Progress',
                'ProgressPendingPaymentAt', 'ProgressPendingPaymentBy', 'ProgressPendingPaymentComment',
                'ProgressPartiallyPaidAt', 'ProgressPartiallyPaidBy', 'ProgressPartiallyPaidComment',
                'ProgressPaidAt', 'ProgressPaidBy', 'ProgressPaidComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Subtotal: 0, Discount: 0, TotalTaxableAmount: 0, TotalTaxAmount: 0, TaxDetails: '[]', OutletReturnCodes: '', ReturnDeductionTotal: 0, SettlementMismatchAmount: 0, SettlementReason: '', Progress: 'PENDING_PAYMENT' },
            // OutletConsumptionCode holds a COMMA-SEPARATED list when several
            // consumptions are bundled onto one invoice, so it is sized for 3-4 codes.
            columnWidths: { Code: 150, OutletConsumptionCode: 320, Date: 140, DueDate: 140, OutletCode: 140, Username: 170, PriceListCode: 170, Subtotal: 120, Discount: 120, TotalTaxableAmount: 150, TotalTaxAmount: 120, TaxDetails: 250, OutletReturnCodes: 180, ReturnDeductionTotal: 150, SettlementMismatchAmount: 190, SettlementReason: 180, Progress: 170, ProgressPendingPaymentAt: 180, ProgressPendingPaymentBy: 180, ProgressPendingPaymentComment: 230, ProgressPartiallyPaidAt: 180, ProgressPartiallyPaidBy: 180, ProgressPartiallyPaidComment: 230, ProgressPaidAt: 160, ProgressPaidBy: 160, ProgressPaidComment: 210, ProgressCancelledAt: 170, ProgressCancelledBy: 170, ProgressCancelledComment: 220, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_CONSUMPTION_INVOICE_ITEMS,
            headers: ['Code', 'OutletConsumptionInvoiceCode', 'SKU', 'Qty', 'Price', 'Total', 'Discount', 'TaxableAmount', 'TaxAmount', 'TaxCode', 'Status'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', Qty: 0, Price: 0, Total: 0, Discount: 0, TaxableAmount: 0, TaxAmount: 0, TaxCode: '' },
            columnWidths: { Code: 150, OutletConsumptionInvoiceCode: 220, SKU: 150, Qty: 120, Price: 120, Total: 120, Discount: 120, TaxableAmount: 140, TaxAmount: 120, TaxCode: 130, Status: 100 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_PAYMENTS,
            headers: ['Code', 'Date', 'OutletCode', 'OutletConsumptionInvoiceCode', 'Amount', 'Mode', 'Reference', 'Username', 'Progress',
                      'ProgressSubmittedAt', 'ProgressSubmittedBy', 'ProgressSubmittedComment',
                      'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                      'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Amount: 0, Progress: 'SUBMITTED' },
            columnWidths: {
                Code: 150, Date: 130, OutletCode: 140, OutletConsumptionInvoiceCode: 220, Amount: 120, Mode: 130, Reference: 180, Username: 170, Progress: 140,
                ProgressSubmittedAt: 160, ProgressSubmittedBy: 150, ProgressSubmittedComment: 200,
                ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 200,
                Status: 100, AccessRegion: 130
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_MOVEMENTS,
            headers: ['Code', 'OutletCode', 'StorageName', 'SKU', 'QtyChange', 'ReferenceType', 'ReferenceCode', 'ReferenceItemCode', 'MovementDate', 'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active', defaults: { Status: 'Active', StorageName: '_default', QtyChange: 0 },
            columnWidths: { Code: 150, OutletCode: 140, StorageName: 150, SKU: 150, QtyChange: 120, ReferenceType: 150, ReferenceCode: 160, ReferenceItemCode: 170, MovementDate: 130, Status: 100, AccessRegion: 130 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.OUTLET_STORAGES,
            headers: ['Code', 'OutletCode', 'SKU', 'Quantity'],
            defaults: { Quantity: 0 },
            columnWidths: { Code: 150, OutletCode: 140, SKU: 150, Quantity: 120 }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFERS,
            headers: ['Code', 'SourceWarehouseCode', 'DestinationWarehouseCode', 'Date', 'Username', 'Reference', 'IsInstant', 'Progress',
                      'ProgressPendingApprovalAt', 'ProgressPendingApprovalBy', 'ProgressPendingApprovalComment',
                      'ProgressApprovedAt', 'ProgressApprovedBy', 'ProgressApprovedComment',
                      'ProgressCompletedAt', 'ProgressCompletedBy', 'ProgressCompletedComment',
                      'ProgressRejectedAt', 'ProgressRejectedBy', 'ProgressRejectedComment',
                      'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'DRAFT', IsInstant: 'FALSE' },
            columnWidths: {
                Code: 150, SourceWarehouseCode: 150, DestinationWarehouseCode: 180, Date: 130, Username: 150, Reference: 150, IsInstant: 100, Progress: 150,
                ProgressPendingApprovalAt: 170, ProgressPendingApprovalBy: 160, ProgressPendingApprovalComment: 200,
                ProgressApprovedAt: 160, ProgressApprovedBy: 150, ProgressApprovedComment: 200,
                ProgressCompletedAt: 170, ProgressCompletedBy: 160, ProgressCompletedComment: 200,
                ProgressRejectedAt: 160, ProgressRejectedBy: 150, ProgressRejectedComment: 200,
                Status: 100, AccessRegion: 130
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.WAREHOUSE_TRANSFER_ITEMS,
            headers: ['Code', 'WarehouseTransferCode', 'SKUCode', 'Quantity', 'SourceStorageName', 'DestinationStorageName', 'Progress',
                      'ProgressTransferredAt', 'ProgressTransferredBy', 'ProgressTransferredComment',
                      'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                      'Status'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Quantity: 0, Progress: 'PENDING', SourceStorageName: '_default', DestinationStorageName: '_default' },
            columnWidths: {
                Code: 150, WarehouseTransferCode: 180, SKUCode: 150, Quantity: 100, SourceStorageName: 160, DestinationStorageName: 200, Progress: 130,
                ProgressTransferredAt: 170, ProgressTransferredBy: 160, ProgressTransferredComment: 200,
                ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 200,
                Status: 100
            }
        },
        {
            resourceName: CONFIG.OPERATION_SHEETS.LEAD_FOLLOW_UPS,
            headers: ['Code', 'LeadCode', 'Date', 'RespondDate', 'Username', 'Purpose', 'PurposeDetail', 'Outcome', 'Progress',
                'ProgressCompletedAt', 'ProgressCompletedBy', 'ProgressCompletedComment',
                'ProgressPostponedAt', 'ProgressPostponedBy', 'ProgressPostponedComment',
                'ProgressCancelledAt', 'ProgressCancelledBy', 'ProgressCancelledComment',
                'Status', 'AccessRegion'].concat(commonAuditColumns),
            statusDefault: 'Active',
            defaults: { Status: 'Active', Progress: 'Awaiting' },
            columnWidths: {
                Code: 150, LeadCode: 140, Date: 130, RespondDate: 170, Username: 170,
                Purpose: 170, PurposeDetail: 260, Outcome: 260, Progress: 140,
                ProgressCompletedAt: 160, ProgressCompletedBy: 150, ProgressCompletedComment: 220,
                ProgressPostponedAt: 160, ProgressPostponedBy: 150, ProgressPostponedComment: 220,
                ProgressCancelledAt: 160, ProgressCancelledBy: 150, ProgressCancelledComment: 220,
                Status: 100, AccessRegion: 130
            }
        }
    ];
}

function setupOperationSheets(options) {
    options = options || {};
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();
    resetLogSheet_();

    logToSheet_('Starting Setup All Operation');

    const schemaByResource = setup_getOperationSchemas();
    const selectedResources = options.selectedResources;
    const decisions = options.decisions || {};

    const schemasToProcess = (selectedResources && selectedResources.length > 0)
        ? schemaByResource.filter(function (s) { return selectedResources.indexOf(s.resourceName) !== -1; })
        : schemaByResource;

    const results = [];

    schemasToProcess.forEach(function (schema) {
        try {
            const outcome = setup_refactorResourceSheet(schema, {
                decisions: decisions,
                allSchemas: schemaByResource,
                headerColor: OPERATION_HEADER_COLOR,
                altColor: OPERATION_ALT_ROW_COLOR
            });
            const prefix = outcome.isNewSheet ? 'Created: ' : 'Updated: ';
            results.push(prefix + schema.resourceName + (outcome.changed ? ' (' + outcome.message + ')' : ' (no change)'));
        } catch (err) {
            results.push('Error for ' + schema.resourceName + ': ' + err.message);
        }
    });

    logToSheet_('Setup All Operation completed');

    const summary = 'OPERATION setup (Resources driven) complete.\n\n' + results.join('\n');

    // Clear all caches after setup
    if (typeof clearAllAppCaches === 'function') clearAllAppCaches();

    Logger.log(summary);
    if (!options.dialog) {
        try {
            SpreadsheetApp.getUi().alert(summary);
        } catch (e) {
            // Non-UI context
        }
    }
    return summary;
}
