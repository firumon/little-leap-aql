/**
 * ============================================================
 * AQL - Global Constants
 * ============================================================
 */

const CONFIG = {
  BRAND_COLOR: '#4a86c8',
  SHEETS: {
    USERS: 'Users',
    ACCESS_REGIONS: 'AccessRegions',
    DESIGNATIONS: 'Designations',
    ROLES: 'Roles',
    ROLE_PERMISSIONS: 'RolePermissions',
    RESOURCES: 'Resources',
    CONFIG: 'Config',
    METADATA: 'Metadata',
    APP_OPTIONS: 'AppOptions'
  },
  MASTER_SHEETS: {
    PRODUCTS: 'Products',
    SKUS: 'SKUs',
    UOMS: 'UOMs',
    SUPPLIERS: 'Suppliers',
    WAREHOUSES: 'Warehouses',
    OUTLETS: 'Outlets',
    OUTLET_OPERATING_RULES: 'OutletOperatingRules',
    PORTS: 'Ports',
    CARRIERS: 'Carriers'
  },
  OPERATION_SHEETS: {
    PROCUREMENTS: 'Procurements',
    PURCHASE_REQUISITIONS: 'PurchaseRequisitions',
    PURCHASE_REQUISITION_ITEMS: 'PurchaseRequisitionItems',
    RFQS: 'RFQs',
    RFQ_SUPPLIERS: 'RFQSuppliers',
    SUPPLIER_QUOTATIONS: 'SupplierQuotations',
    SUPPLIER_QUOTATION_ITEMS: 'SupplierQuotationItems',
    PURCHASE_ORDERS: 'PurchaseOrders',
    PURCHASE_ORDER_ITEMS: 'PurchaseOrderItems',
    PO_RECEIVINGS: 'POReceivings',
    PO_RECEIVING_ITEMS: 'POReceivingItems',
    PO_FULFILLMENTS: 'POFulfillments',
    SHIPMENTS: 'Shipments',
    SHIPMENT_ITEMS: 'ShipmentItems',
    PORT_CLEARANCE: 'PortClearance',
    GOODS_RECEIPTS: 'GoodsReceipts',
    GOODS_RECEIPT_ITEMS: 'GoodsReceiptItems',
    STOCK_MOVEMENTS: 'StockMovements',
    WAREHOUSE_STORAGES: 'WarehouseStorages',
    OUTLET_VISITS: 'OutletVisits',
    OUTLET_RESTOCKS: 'OutletRestocks',
    OUTLET_RESTOCK_ITEMS: 'OutletRestockItems',
    OUTLET_DELIVERIES: 'OutletDeliveries',
    OUTLET_CONSUMPTION: 'OutletConsumption',
    OUTLET_CONSUMPTION_ITEMS: 'OutletConsumptionItems',
    OUTLET_MOVEMENTS: 'OutletMovements',
    OUTLET_STORAGES: 'OutletStorages'
  },
  ACCOUNTS_SHEETS: {
    ASSETS: 'Assets',
    LIABILITIES: 'Liabilities',
    EQUITY: 'Equity',
    REVENUE: 'Revenue',
    EXPENSES: 'Expenses',
    CHART_OF_ACCOUNTS: 'ChartOfAccounts',
    ENTRY_TEMPLATES: 'EntryTemplates'
  },
  VIEW_SHEETS: {
    // Placeholder â€” view sheets will be added as they are designed
  }
};

/**
 * Seed data for the AppOptions sheet.
 * Each key maps to an ordered list of selectable option values.
 * Rule: When adding a new option group here, also add a matching
 *       dropdown validation in the relevant setup script.
 */
const  APP_OPTIONS_SEED = {
  StockMovementReferenceType: ['GRN', 'DirectEntry', 'StockAdjustment', 'OutletRestock', 'OutletDeliveryCancel'],
  PurchaseRequisitionType: ['STOCK', 'PROJECT', 'SALES', 'ASSET'],
  PurchaseRequisitionPriority: ['Low', 'Medium', 'High', 'Urgent'],
  PurchaseRequisitionProgress: ['Draft', 'Pending Approval', 'Revision Required', 'Approved', 'Rejected', 'RFQ Processed'],
  ProcurementProgress: ['INITIATED', 'PR_CREATED', 'PR_APPROVED', 'RFQ_GENERATED','RFQ_SENT_TO_SUPPLIERS','QUOTATIONS_RECEIVED', 'PO_ISSUED', 'GOODS_RECEIVING', 'GRN_GENERATED', 'IN_TRANSIT', 'ARRIVED_AT_PORT', 'COMPLETED', 'CANCELLED'],
  POReceivingProgress: ['DRAFT', 'CONFIRMED', 'GRN_GENERATED', 'CANCELLED'],
  OutletVisitStatus: ['PLANNED', 'COMPLETED', 'POSTPONED', 'CANCELLED'],
  OutletRestockProgress: ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED'],
  OutletDeliveryProgress: ['SCHEDULED', 'DELIVERED', 'CANCELLED'],
  OutletMovementReferenceType: ['RestockDelivery', 'Consumption', 'Adjustment'],
  RFQLeadTimeType: ['FLEXIBLE','STRICT','RANGE_10','RANGE_25'],
  RFQShippingTermMode: ['ANY','FIXED'],
  RFQShippingTerm: ['EXW','FOB','CIF','DDP'],
  RFQPaymentTermMode: ['ANY','FIXED'],
  RFQPaymentTerm: ['ADVANCE','PARTIAL','CAD','LC','CREDIT'],
  RFQQuotationValidityMode: ['MIN_REQUIRED','MAX_ALLOWED','FLEXIBLE'],
  RFQDeliveryMode: ['ANY','FIXED'],
  RFQProgress: ['DRAFT','SENT','CLOSED','CANCELLED'],
  RFQSupplierProgress: ['ASSIGNED','SENT','RESPONDED','DECLINED','CANCELLED'],
  SupplierQuotationResponseType: ['QUOTED','PARTIAL','DECLINED'],
  SupplierQuotationProgress: ['RECEIVED','ACCEPTED','REJECTED'],
  PurchaseOrderProgress: ['CREATED','SENT','ACKNOWLEDGED','ACCEPTED','CANCELLED','CLOSED'],
  SupplierQuotationExtraChargeType: ['tax','freight','commission','handling','other'],
  Currency: ['AED'],
};
