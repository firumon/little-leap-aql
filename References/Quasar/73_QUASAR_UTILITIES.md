# Quasar Utilities Reference Guide

This reference guide describes the configuration and usage of Quasar's native utility libraries (such as `date`, `format`, `dom`, and `patterns`) to format values, validate inputs, and perform DOM queries.

---

## 1. Overview of Quasar Utilities

Quasar includes lightweight, tree-shakable JavaScript helper libraries that address common formatting and validation tasks. Utilizing these built-in helpers reduces reliance on heavy third-party packages (e.g., Moment.js, date-fns, or Lodash):

*   **`date`**: Provides functions for formatting, parsing, comparing, and manipulating date values (e.g., handling timezone offsets, leap years, or additions/subtractions).
*   **`format`**: Contains string and numeric formatting utilities, such as converting byte counts to human-readable file sizes, camel-casing strings, or capitalizing text.
*   **`patterns`**: Exposes pre-tested regular expressions and test methods for verifying standard inputs (e.g., emails, phone numbers, hex colors).
*   **`dom`**: Simplifies browser-compliant queries for element dimensions, scroll positions, offsets, and styles.

---

## 2. Code Examples

### Format and Validation Composable

The following example demonstrates how to import and apply Quasar's utility packages to handle date parsing, email verification, file sizing, and element height calculations:

```javascript
// composables/useAppUtilities.js
import { date, format, patterns, dom } from 'quasar'

export function useAppUtilities() {

  // 1. Format date display
  const formatDateString = (rawDateString) => {
    if (!rawDateString) return ''
    const dateObj = new Date(rawDateString)
    return date.formatDate(dateObj, 'YYYY-MM-DD HH:mm')
  }

  // 2. Validate email structure using standard pattern
  const validateEmailFormat = (emailString) => {
    return patterns.testPattern.email(emailString) || 'Invalid email address format'
  }

  // 3. Convert numbers to file size labels
  const formatFileSize = (bytesCount) => {
    return format.humanStorageSize(bytesCount)
  }

  // 4. Calculate heights dynamically
  const getContainerHeight = (elementRef) => {
    if (!elementRef) return 0
    return dom.height(elementRef)
  }

  return {
    formatDateString,
    validateEmailFormat,
    formatFileSize,
    getContainerHeight
  }
}
```

### Date Range Validation

The `date` utility can calculate the difference between dates to validate input ranges:

```javascript
// composables/operations/useDateRange.js
import { ref } from 'vue'
import { date } from 'quasar'

export function useDateRange() {
  const startDate = ref('')
  const endDate = ref('')

  const isRangeValid = () => {
    if (!startDate.value || !endDate.value) return false
    
    const startObj = new Date(startDate.value)
    const endObj = new Date(endDate.value)
    const diff = date.getDateDiff(endObj, startObj, 'days')
    
    return diff >= 0
  }

  return {
    startDate,
    endDate,
    isRangeValid
  }
}
```

---

## 3. Technical Considerations

*   **Tree-Shaking Support**: Importing specific sub-modules (e.g., `import { date } from 'quasar'`) rather than importing the entire package structure allows build tools to optimize the production bundle.
*   **Timezone and Offset Safety**: Using methods like `date.addToDate` or `date.subtractFromDate` prevents common timezone offsets and day-transition bugs that often occur when manually manipulating standard JavaScript `Date` objects.
*   **Input Validation Integration**: Quasar input rules (`rules` prop on `QInput`) can directly execute methods like `patterns.testPattern.email` to display errors dynamically.
*   **Cross-Browser DOM Inquiries**: The `dom` utility abstracts away differences in how browsers report element client heights, paddings, and scroll offsets, ensuring consistent calculations across mobile and desktop browsers.
