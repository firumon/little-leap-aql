# Master Resource Customization

## Overview

The Masters module's frontend architecture is designed for deep customization, allowing tenant-specific or entity-specific overrides for various UI components. This is achieved through a multi-tiered component resolution system powered by `useSectionResolver.js`.

- **3-Tier Resolution**: Standard page sections (like `ListRecords`, `ViewHeader`) are resolved using a 3-tier system.
- **6-Tier Resolution**: Key sub-components within sections (like `ViewChild`) use an extended 6-tier system for more granular control.

The key to this system is the `customUIName` property, which can be set in a resource's configuration. This acts as a tenant or group identifier, forming the base path for custom component lookups.

## Directory Structure

Custom components for Masters resources must be placed in specific subdirectories to be discovered by the resolver.

- **Scope**: `components/Masters/`
- **Custom Root**: `components/Masters/_custom/`

The resolution order is as follows:

1.  **Tenant + Entity Specific**:
    - Path: `components/Masters/_custom/{CustomUIName}/{Entity}/{ComponentName}.vue`
    - Example: `_custom/A123/Products/MasterViewChild.vue`
    - Use case: A component override that applies *only* to `Products` for tenant `A123`.

2.  **Tenant-Wide (Cross-Entity)**:
    - Path: `components/Masters/_custom/{CustomUIName}/{ComponentName}.vue`
    - Example: `_custom/A123/MasterListRecordsRecord.vue`
    - Use case: A standardized record card style for *all* Masters resources belonging to tenant `A123`.

3.  **Entity-Specific (All Tenants)**:
    - Path: `components/Masters/{Entity}/{ComponentName}.vue`
    - Example: `Products/MasterViewDetails.vue`
    - Use case: A custom details view for `Products` that applies to *all* tenants.

4.  **Default Fallback**:
    - Path: `components/Masters/_common/{ComponentName}.vue`
    - This is the base component provided by the system.

## Naming Conventions

- **Component Files**: Must be `PascalCase`. E.g., `MasterViewChild.vue`.
- **Entity Folders**: Must be `PascalCase` derived from the resource slug. E.g., `products` -> `Products`.
- **Custom Name Folders**: The `customUIName` from the resource config.

## Component Reference Table

This table lists all customizable components in the Masters module.

| Component | Purpose | Props | Emits | Default file | Custom name pattern |
|---|---|---|---|---|---|
| `MasterListRecordsLoading` | Loading spinner in list | none | none | `_common/MasterListRecordsLoading.vue` | `{Entity}/MasterListRecordsLoading.vue` |
| `MasterListRecordsEmpty` | Empty state in list | none | none | `_common/MasterListRecordsEmpty.vue` | `{Entity}/MasterListRecordsEmpty.vue` |
| `MasterListRecordsRecord` | Single record card in list | `row, resolvePrimaryText, resolveSecondaryText` | `open-detail` | `_common/MasterListRecordsRecord.vue` | `{Entity}/MasterListRecordsRecord.vue` |
| `MasterViewLoading` | Loading spinner on view page | none | none | `_common/MasterViewLoading.vue` | `{Entity}/MasterViewLoading.vue` |
| `MasterViewEmpty` | Not-found state on view page | none | `back` | `_common/MasterViewEmpty.vue` | `{Entity}/MasterViewEmpty.vue` |
| `MasterViewChild` | Single child resource section | `childResource, childRecords, additionalActions` | `view-child` | `_common/MasterViewChild.vue` | `{Entity}/MasterViewChild{PascalChildName}.vue` or `{Entity}/MasterViewChild.vue` |

## Available Helper Functions

When creating custom components, you can import and reuse these helpers from `src/utils/appHelpers.js`.

- `humanizeString(str)`: Converts "camelCase" to "Camel Case".
- `toPascalCase(str)`: Converts "any-string" to "AnyString".
- `AUDIT_HEADERS`: A `Set` of audit field names to exclude (`CreatedAt`, `CreatedBy`, etc.).
- `deriveActionStampHeaders(additionalActions)`: Creates a `Set` of action-related headers to hide (e.g., `ApprovedBy`, `ApprovedAt`).
- `filterDetailFields(resolvedFields, actionStampHeaders)`: Filters fields for a standard detail view.
- `resolveChildFields(childResourceConfig)`: Gets the display fields for a child resource.
- `resolveChildTitle(childResourceConfig)`: Gets the display title for a child resource.

## Step-by-Step Customization Example

**Goal**: Customize the record card for "Products" for a specific tenant, `C456`.

1.  **Set `customUIName`**: In the resource configuration for `products`, ensure `ui.customUIName` is set to `"C456"`.

2.  **Create the file**:
    - The resource slug is `products`, so the `{Entity}` folder name is `Products`.
    - The component to override is `MasterListRecordsRecord`.
    - Create the following file path:
      `src/components/Masters/_custom/C456/Products/MasterListRecordsRecord.vue`

3.  **Implement the component**:
    - Copy the content of the default component from `src/components/Masters/_common/MasterListRecordsRecord.vue` as a starting point.
    - Modify the template as needed. Ensure you respect the props contract (`row`, `resolvePrimaryText`, `resolveSecondaryText`) and emit `open-detail` on click.

    ```vue
    <!-- src/components/Masters/_custom/C456/Products/MasterListRecordsRecord.vue -->
    <template>
      <q-card flat class="custom-pr-card" @click="$emit('open-detail', row)">
        <q-card-section>
          <div class="text-overline">{{ row.Code }}</div>
          <div class="text-h6">{{ row.Name }}</div>
          <div class="text-caption text-grey">Category: {{ row.Category }}</div>
        </q-card-section>
      </q-card>
    </template>

    <script setup>
    defineProps({
      row: Object,
      resolvePrimaryText: Function, // Still received, but unused in this custom version
      resolveSecondaryText: Function, // Still received, but unused
    })
    defineEmits(['open-detail'])
    </script>

    <style scoped>
    .custom-pr-card {
      background-color: #e0f2f1; /* Teal background for this tenant */
      border-left: 5px solid #00796b;
    }
    </style>
    ```

4.  **Restart the dev server**: The new file needs to be discovered by Vite's glob import. Restart your `npm run dev` process. The application will now automatically pick up your custom component for Products where the tenant is `C456`.

## Rules and Gotchas

- **Dev Server Restart**: You **must** restart the Vite dev server after adding a new custom component file. The file paths are discovered at startup.
- **PascalCase is Strict**: All component filenames and entity folder names must be `PascalCase`.
- **Props/Emits Contract**: Custom components must honor the props and emits of the default component they are overriding to ensure compatibility with the parent page.
- **Thin Layout Shells**: For best results, custom components should be thin wrappers focused on layout and presentation. Complex logic should remain in the parent pages and be passed down through props.
