/**
 * ============================================================
 * AQL - Global Constants
 * ============================================================
 */

// CacheService TTL cap is 21600s; every cache below is invalidated explicitly on write.
const CACHE_TTL_SEC = 21600;

// Sheets hard-caps a cell at 50000 chars; large cache payloads are chunked across rows.
const METADATA_CHUNK_CHARS = 45000;

// CacheService caps a value at 100KB and measures BYTES while JS slices CHARACTERS.
const CACHE_CHUNK_CHARS = 50000;

// Chunks fetched speculatively with the manifest so a chunked read costs one round-trip.
const CACHE_CHUNK_PROBE = 4;

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
    METADATA: 'Metadata'
  },
  MASTER_SHEETS: {
    PRODUCTS: 'Products',
    SKUS: 'SKUs',
    UOMS: 'UOMs',
    CURRENCIES: 'Currencies',
    PRICE_LIST: 'PriceList',
    PRICE_LIST_ITEMS: 'PriceListItems',
    SUPPLIERS: 'Suppliers',
    WAREHOUSES: 'Warehouses',
    OUTLETS: 'Outlets',
    OUTLET_OPERATING_RULES: 'OutletOperatingRules',
    TAXES: 'Taxes',
    LEADS: 'Leads',
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
    GOODS_RECEIPTS: 'GoodsReceipts',
    GOODS_RECEIPT_ITEMS: 'GoodsReceiptItems',
    STOCK_MOVEMENTS: 'StockMovements',
    WAREHOUSE_STORAGES: 'WarehouseStorages',
    WAREHOUSE_TRANSFERS: 'WarehouseTransfers',
    WAREHOUSE_TRANSFER_ITEMS: 'WarehouseTransferItems',
    OUTLET_VISITS: 'OutletVisits',
    OUTLET_RESTOCKS: 'OutletRestocks',
    OUTLET_RESTOCK_ITEMS: 'OutletRestockItems',
    OUTLET_DELIVERIES: 'OutletDeliveries',
    OUTLET_RETURNS: 'OutletReturns',
    OUTLET_CONSUMPTIONS: 'OutletConsumptions',
    OUTLET_CONSUMPTION_ITEMS: 'OutletConsumptionItems',
    OUTLET_CONSUMPTION_INVOICES: 'OutletConsumptionInvoices',
    OUTLET_CONSUMPTION_INVOICE_ITEMS: 'OutletConsumptionInvoiceItems',
    OUTLET_PAYMENTS: 'OutletPayments',
    OUTLET_MOVEMENTS: 'OutletMovements',
    OUTLET_STORAGES: 'OutletStorages',
    LEAD_FOLLOW_UPS: 'LeadFollowUps'
  },
  ACCOUNTS_SHEETS: {
    ASSETS: 'Assets',
    LIABILITIES: 'Liabilities',
    EQUITY: 'Equity',
    REVENUE: 'Revenue',
    EXPENSES: 'Expenses',
    CHART_OF_ACCOUNTS: 'ChartOfAccounts',
    ENTRY_TEMPLATES: 'EntryTemplates',
    TAX_TRANSACTIONS: 'TaxTransactions',
  },
  VIEW_SHEETS: {
    // Placeholder — view sheets will be added as they are designed
  }
};
