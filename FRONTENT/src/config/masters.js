export const MASTER_ENTITY_CONFIG = {
  products: {
    order: 1,
    key: 'products',
    resource: 'Products',
    routePath: '/masters/products',
    navLabel: 'Products',
    navIcon: 'inventory_2',
    title: 'Products',
    description: 'Manage product master records',
    fields: [
      { header: 'Name', label: 'Name', type: 'text', required: true },
      { header: 'SKU', label: 'SKU', type: 'text', required: true },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  },
  suppliers: {
    order: 2,
    key: 'suppliers',
    resource: 'Suppliers',
    routePath: '/masters/suppliers',
    navLabel: 'Suppliers',
    navIcon: 'handshake',
    title: 'Suppliers',
    description: 'Manage supplier master records',
    fields: [
      { header: 'Name', label: 'Name', type: 'text', required: true },
      { header: 'Country', label: 'Country', type: 'text' },
      { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
      { header: 'Phone', label: 'Phone', type: 'text' },
      { header: 'Email', label: 'Email', type: 'text' },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  },
  warehouses: {
    order: 3,
    key: 'warehouses',
    resource: 'Warehouses',
    routePath: '/masters/warehouses',
    navLabel: 'Warehouses',
    navIcon: 'warehouse',
    title: 'Warehouses',
    description: 'Manage warehouse master records',
    fields: [
      { header: 'Name', label: 'Name', type: 'text', required: true },
      { header: 'City', label: 'City', type: 'text' },
      { header: 'Country', label: 'Country', type: 'text' },
      { header: 'Type', label: 'Type', type: 'text' },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  },
  warehouseLocations: {
    order: 4,
    key: 'warehouseLocations',
    resource: 'WarehouseLocations',
    routePath: '/masters/warehouse-locations',
    navLabel: 'Locations',
    navIcon: 'grid_on',
    title: 'Warehouse Locations',
    description: 'Manage shelf/bin location master records',
    fields: [
      { header: 'WarehouseCode', label: 'Warehouse Code', type: 'text', required: true },
      { header: 'LocationCode', label: 'Location Code', type: 'text', required: true },
      { header: 'Description', label: 'Description', type: 'text' },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  },
  carriers: {
    order: 5,
    key: 'carriers',
    resource: 'Carriers',
    routePath: '/masters/carriers',
    navLabel: 'Carriers',
    navIcon: 'local_shipping',
    title: 'Carriers',
    description: 'Manage carrier master records',
    fields: [
      { header: 'Name', label: 'Name', type: 'text', required: true },
      { header: 'Type', label: 'Type', type: 'text' },
      { header: 'Phone', label: 'Phone', type: 'text' },
      { header: 'ContactPerson', label: 'Contact Person', type: 'text' },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  },
  ports: {
    order: 6,
    key: 'ports',
    resource: 'Ports',
    routePath: '/masters/ports',
    navLabel: 'Ports',
    navIcon: 'anchor',
    title: 'Ports',
    description: 'Manage port master records',
    fields: [
      { header: 'Name', label: 'Name', type: 'text', required: true },
      { header: 'Country', label: 'Country', type: 'text' },
      { header: 'PortType', label: 'Port Type', type: 'text' },
      { header: 'Status', label: 'Status', type: 'status', required: true }
    ]
  }
}

export function getMasterConfigByKey(key) {
  if (!key) return null
  return MASTER_ENTITY_CONFIG[key] || null
}
