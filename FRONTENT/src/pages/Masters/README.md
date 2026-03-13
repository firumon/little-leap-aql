# Master Pages Architecture

## Overview

The Master Pages system provides a flexible architecture for managing master data entities. It supports both **generic** and **custom** page implementations with automatic file-based discovery.

## How It Works

### 1. MasterIndexPage (Router Entry Point)

**File:** `MasterIndexPage.vue`

This is the main entry point for all master entity routes (`/masters/:resourceSlug`). It automatically tries to load a custom page, falling back to the generic page if none exists:

```
User navigates to /masters/products
         ↓
   MasterIndexPage tries to import ProductsPage.vue
         ↓
   ┌─────────────────┬──────────────────┐
   │ File exists?    │ File not found?  │
   ↓                 ↓                  │
ProductsPage.vue   MasterEntityPage.vue
(Custom UI)        (Generic Fallback)
```

### 2. File-Based Convention

**Zero Configuration Required!**

Just create a component file following the naming pattern and it automatically works:

| Route Slug           | Component Name         | Auto-loaded? |
|----------------------|------------------------|--------------|
| `products`           | `ProductsPage.vue`     | ✅ Yes       |
| `price-lists`        | `PriceListsPage.vue`   | ✅ Yes       |
| `customer-groups`    | `CustomerGroupsPage.vue`| ✅ Yes      |
| `vendors`            | `VendorsPage.vue`      | ✅ Yes       |

**Pattern:** `kebab-case-slug` → `PascalCasePage.vue`

### 3. MasterEntityPage (Generic Fallback)

**File:** `MasterEntityPage.vue`

A fully-featured generic page that works for any master entity with:
- Dynamic field resolution from `APP.Resources` configuration
- CRUD operations (Create, Read, Update)
- Search and filtering
- Status toggle (Active/Inactive)
- Responsive card layout
- IndexedDB caching
- Background sync

**Use this when:** Standard CRUD is sufficient for your entity.

## Creating a Custom Page

### When to Create a Custom Page

Create a custom page when you need:
- ✅ Entity-specific UI layout (e.g., product grid with images)
- ✅ Advanced filtering beyond basic search
- ✅ Custom business logic (e.g., price calculations, inventory rules)
- ✅ Specialized data visualizations
- ✅ Integration with entity-specific APIs or workflows

### Simple 2-Step Process

#### Step 1: Create the Component File

Determine the component name from your route:

```javascript
// Route: /masters/products → Component: ProductsPage.vue
// Route: /masters/price-lists → Component: PriceListsPage.vue
// Route: /masters/vendors → Component: VendorsPage.vue
```

Create the file in `FRONTENT/src/pages/Masters/`:

```
FRONTENT/src/pages/Masters/
├── MasterIndexPage.vue        # Router entry (core)
├── MasterEntityPage.vue       # Generic fallback (core)
├── ProductsPage.vue           # Your custom page ✨
└── README.md                  # This file
```

#### Step 2: Implement Your Logic

**Option A: Build from Scratch**

```vue
<template>
  <q-page class="custom-products-page">
    <!-- Your custom UI here -->
    <h2>Custom Products Interface</h2>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { fetchMasterRecords } from 'src/services/masterRecords'

const products = ref([])

async function loadProducts() {
  const response = await fetchMasterRecords('Products')
  if (response.success) {
    products.value = response.records
  }
}

loadProducts()
</script>
```

**Option B: Extend Generic Page**

```vue
<template>
  <q-page>
    <!-- Add custom header -->
    <div class="custom-toolbar">
      <q-input v-model="customSearch" label="Advanced Search" />
    </div>

    <!-- Reuse generic CRUD functionality -->
    <MasterEntityPage />
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import MasterEntityPage from './MasterEntityPage.vue'

const customSearch = ref('')
</script>
```

**That's it!** No registration, no configuration. Just create the file and navigate to the route.

## Examples

### Example 1: ProductsPage.vue

**File:** `ProductsPage.vue` (included in this directory)

A demonstration custom page showing:
- Custom header styling
- Information about the pattern
- Embedded generic page for comparison

**Route:** `/masters/products`

### Example 2: Creating VendorsPage.vue

```vue
<!-- FRONTENT/src/pages/Masters/VendorsPage.vue -->
<template>
  <q-page class="vendors-page">
    <h2>Vendor Management</h2>

    <!-- Custom: Vendor rating system -->
    <VendorRatingWidget :vendors="vendors" />

    <!-- Standard CRUD -->
    <MasterEntityPage />
  </q-page>
</template>

<script setup>
import MasterEntityPage from './MasterEntityPage.vue'
import VendorRatingWidget from './components/VendorRatingWidget.vue'
</script>
```

Just save this file and visit `/masters/vendors` - it works automatically!

## Naming Convention

### Route to Component Conversion

The system uses a simple conversion:

1. Take the route slug (after `/masters/`)
2. Split by hyphens
3. Capitalize each word
4. Add "Page.vue"

**Examples:**

```javascript
'products'         → 'ProductsPage.vue'
'price-lists'      → 'PriceListsPage.vue'
'customer-groups'  → 'CustomerGroupsPage.vue'
'tax-categories'   → 'TaxCategoriesPage.vue'
```

## Architecture Benefits

### 1. **Zero Configuration**
Create a file, it works. No routes to update, no registry to maintain.

### 2. **Progressive Enhancement**
Start with generic page, create custom pages only when needed.

### 3. **Automatic Fallback**
Missing custom page? No problem - generic page loads automatically.

### 4. **Code Reusability**
Custom pages can import and embed `MasterEntityPage` for standard functionality.

### 5. **File-Based Discovery**
If the file exists, it's used. Simple as that.

## Debugging

### Check which page is loaded

**Use Vue DevTools:**
1. Open browser DevTools
2. Go to Vue tab
3. Inspect component tree
4. Should show either `CustomPage` or `MasterEntityPage`

### Verify the route

```javascript
// In browser console (when on a master page):
console.log(window.location.pathname)  // e.g., /masters/products
console.log($route.params.resourceSlug)  // e.g., 'products'
```

### Test if custom page exists

Navigate to the route and check network tab:
- If custom page exists: see `ProductsPage.vue` loaded
- If not: only `MasterEntityPage.vue` loads

**Note:** You may see a red 404 in network tab when custom page doesn't exist - this is normal and harmless. It's just the system checking if the file exists before falling back.

## Best Practices

### 1. **Use Generic Page by Default**
Only create custom pages when standard CRUD isn't sufficient.

### 2. **Follow Naming Convention**
Stick to the pattern: `{ResourceName}Page.vue`

### 3. **Reuse Generic Components**
Import `MasterEntityPage` instead of rebuilding CRUD from scratch.

### 4. **Document Custom Logic**
Add comments explaining why custom page was needed and what it does.

### 5. **Test Fallback**
Delete custom page temporarily to ensure fallback works correctly.

## Files Reference

| File | Purpose | When to Modify |
|------|---------|----------------|
| `MasterIndexPage.vue` | Auto-discovery router | Never (core system) |
| `MasterEntityPage.vue` | Generic CRUD page | To improve generic features |
| `{Entity}Page.vue` | Custom entity pages | When entity needs custom UI |
| `README.md` | Documentation | To add examples/patterns |

## FAQ

**Q: Do I need to register my custom page somewhere?**
A: No! Just create the file with the correct name and it works.

**Q: What if I see 404 errors in network tab?**
A: That's normal - it's the system checking if a custom page exists before using the fallback.

**Q: Can I use both custom and generic pages in the same route?**
A: Yes! Import `MasterEntityPage` into your custom page and embed it.

**Q: How do I remove a custom page?**
A: Just delete the file. The system will automatically use the generic page.

**Q: Does this work for nested routes?**
A: Currently only for `/masters/:resourceSlug`. The slug is converted to the component name.

---

**Quick Start:** Create `VendorsPage.vue` in this directory, add some content, navigate to `/masters/vendors`. Done! 🎉
