# Content Component - Quick Reference

## Import
```vue
import Content from 'components/_common/Content.vue'
```

## Basic Usage
```vue
<Content
  :page="'Index'"
  :list-props="listProps"
  @navigate-to-view="handleNavigate"
/>
```

## Props Summary

| Prop | Type | Description |
|------|------|-------------|
| `page` | String | 'Index' \| 'Add' \| 'Edit' \| 'View' \| 'Action' |
| `activeMode` | String | 'list' \| 'form' \| 'detail' (overrides page) |
| `listProps` | Object | Props for List subsection |
| `formProps` | Object | Props for Form subsection |
| `detailProps` | Object | Props for Detail subsection |
| `contentConfig` | Object | General configuration |

## Auto Mode Detection

| Page | Renders |
|------|---------|
| Index | List |
| Add | Form |
| Edit | Form |
| View | Detail |
| Action | Form |

## Subsection Props

### List Props
```javascript
{
  items: Array,
  loading: Boolean,
  resolvedFields: Array,
  childCountMap: Object,
  resourceSlug: String,
  customUIName: String,
  recordsConfig: Object,
  listConfig: Object
}
```

### Form Props
```javascript
{
  code: String,
  resolvedFields: Array,
  parentForm: Object,
  childGroups: Array,
  statusOptions: Array,
  resourceName: String,
  formConfig: Object,
  formFieldRender: Function  // NEW
}
```

### Detail Props
```javascript
{
  record: Object,
  resolvedFields: Array,
  resourceName: String,
  detailsConfig: Object,
  detailItemRender: Function  // NEW
}
```

## Events

```vue
<!-- List Events -->
@navigate-to-view="handleNavigate"

<!-- Form Events -->
@update:field="handleUpdateField"
@update:action-field="handleUpdateActionField"
@update:selected-outcome="handleUpdateOutcome"
@add-child="handleAddChild"
@remove-child="handleRemoveChild"
@update-child-field="handleUpdateChildField"
```

## Custom Field Rendering (Form)

```javascript
function customFieldRender(field, context) {
  // field: field definition
  // context: { parentForm, actionForm, code, isActionForm }
  
  if (field.header === 'Price') {
    return PriceFieldComponent
  }
  return null // Use default
}

// Pass to form
formProps = {
  formFieldRender: customFieldRender
}
```

## Custom Item Rendering (Detail)

```javascript
function customDetailItemRender(field, record) {
  // field: field definition
  // record: record object
  
  if (field.header === 'Status') {
    return StatusBadgeComponent
  }
  return null // Use default
}

// Pass to detail
detailProps = {
  detailItemRender: customDetailItemRender
}
```

## Configuration

### List Config
```javascript
listConfig: {
  layout: 'list' | 'grid',
  gridCols: 2,
  bordered: true,
  flat: true,
  emptyMessage: 'No items found'
}
```

### Form Config
```javascript
formConfig: {
  columns: 1,
  sections: [
    {
      title: 'Section 1',
      fields: ['Field1', 'Field2'],
      collapsible: true,
      collapsed: false
    }
  ],
  fieldConfigs: {
    'Field1': {
      label: 'Custom Label',
      required: true,
      hint: 'Custom hint'
    }
  }
}
```

### Detail Config
```javascript
detailsConfig: {
  title: 'Details',
  columns: 1,
  fields: ['Code', 'Name'],
  fieldLabels: {
    'Code': 'Product Code'
  }
}
```

## Features

### List
✅ Clickable items navigate to view  
✅ Grid/List layout support  
✅ Loading state  
✅ Empty state  
✅ Child count badges  
✅ Hover effects  
✅ Custom overrides  

### Form
✅ Dense field spacing (4px)  
✅ Attractive gradient styling  
✅ Multi-column layout  
✅ Collapsible sections  
✅ Custom field rendering  
✅ Child record management  
✅ Function-based customization  

### Detail
✅ Enhanced styling  
✅ Uppercase field labels  
✅ Accent bar decoration  
✅ Multi-column layout  
✅ Custom item rendering  
✅ File preview support  

## Styling Classes

### Form
- `.form-card` - Main card wrapper
- `.field-label` - Section labels
- `.field-item` - Individual field container

### Detail
- `.detail-card` - Main card wrapper
- `.section-title` - Section title with accent bar
- `.detail-item` - Field/value pair
- `.detail-key` - Field label
- `.detail-val` - Field value

### List
- `.list-card` - Main card wrapper
- `.card-list` - List container
- `.record-list-item` - Item with hover effect
- `.record-children` - Child count badges

## Common Patterns

### List with Navigation
```vue
<Content page="Index" :list-props="listProps" @navigate-to-view="goToView" />
```

### Form with Custom Fields
```vue
<Content
  page="Add"
  :form-props="formProps"
  @update:field="updateField"
/>
```

### Detail with Custom Display
```vue
<Content
  page="View"
  :detail-props="detailProps"
/>
```

### Multi-Column Layout
```javascript
formConfig: { columns: 2 }
detailsConfig: { columns: 2 }
```

### Collapsible Sections
```javascript
formConfig: {
  sections: [{
    title: 'Advanced',
    collapsible: true,
    collapsed: true
  }]
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| List items not clickable | Check `@navigate-to-view` handler |
| Form fields missing | Verify `resolvedFields` has data |
| Detail not rendering | Ensure `record` object is populated |
| Custom renderer not firing | Check function is passed (not string) |
| Wrong mode showing | Verify `page` prop is correct |

## File Locations

| Component | Path |
|-----------|------|
| Content | `_common/Content.vue` |
| List | `_common/sections/Content/List.vue` |
| Form | `_common/sections/Content/Form.vue` |
| Detail | `_common/sections/Content/Detail.vue` |
| Guide | `Documents/CONTENT_COMPONENT_GUIDE.md` |
| Examples | `Documents/CONTENT_COMPONENT_EXAMPLES.md` |

## Next Steps

1. **Test List**: Click items, verify navigation
2. **Test Form**: Edit fields, verify updates
3. **Test Detail**: View records, verify display
4. **Customize Fields**: Use formFieldRender prop
5. **Customize Items**: Use detailItemRender prop
6. **Create Overrides**: Build resource-specific components
7. **Build & Deploy**: Run `npm run build`

