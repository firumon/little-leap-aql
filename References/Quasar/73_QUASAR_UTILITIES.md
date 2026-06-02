# 73_QUASAR_UTILITIES.md - Framework Utilities & Format helpers

This document defines how to import and utilize Quasar's built-in helper utilities (`date`, `format`, `dom`, `patterns`) to format dates, strings, numbers, and test email/phone regex patterns.

---

## 1. Purpose

The purpose of this guide is to ensure all data transformations utilize lightweight, built-in utilities, preventing the import of heavy third-party dependencies (like Moment.js or Lodash).

---

## 2. Core Philosophy

AQL utilities are **Lightweight, Built-In, and Standardized**:
*   **Zero-dependency Dates:** All date conversions, offset shifts, and parsing rules must use Quasar's standard `date` library module.
*   **Format Uniformity:** Large currency formatting or byte calculations must fetch formulas from Quasar's standard `format` helpers.
*   **Standard Validation Patterns:** Text field verification (such as validating email patterns) must utilize pre-tested expressions in Quasar's `patterns` package.

---

## 3. Golden Rules

1.  **Prohibit Third-Party Date Libraries:** Never import Moment.js or date-fns. Use Quasar's built-in `date` helper.
2.  **Use Pre-Tested Regex Patterns:** Validation rules checking email or hex patterns must query Quasar's `patterns` directory (e.g. `patterns.testPattern.email`).
3.  **Perform Safe DOM Calculations:** Query offsets and heights using Quasar's `dom` package wrappers to avoid browser compatibility issues.
4.  **Incorporate Native Format Helpers:** Display numbers, currency, and file byte structures using standard format conversions.

---

## 4. Quasar Utilities Layout Setup

```javascript
// FRONTENT/src/composables/useAppUtilities.js
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

---

## 5. Best Practices

*   **Avoid Custom Date Math:** When adding or subtracting date offsets, use native math helpers: `date.addToDate(new Date(), { days: 7 })`. This prevents bugs related to leap years or timezone shifts.
*   **String Formatting Capitalization:** Use string formatters (`format.capitalize`) to normalize text values dynamically before outputting details.

---

## 6. Mobile First Rules

*   **Human Readable Dates:** Display dates on cards using compact, human-friendly structures: `date.formatDate(dateVal, 'DD MMM YYYY')` (e.g., "12 Jun 2026") to conserve mobile card space.
*   **Debounced Action Listeners:** Wrap touch gestures and scrolling events using native event handlers.

---

## 7. Common Patterns

### Date Range Calculation Pattern

Verify date range boundaries inside form inputs:

```javascript
// FRONTENT/src/composables/operations/useDateRange.js
import { ref } from 'vue'
import { date } from 'quasar'

export function useDateRange() {
  const startDate = ref('')
  const endDate = ref('')

  const isRangeValid = () => {
    if (!startDate.value || !endDate.value) return false
    
    // Check if end date matches or follows start date
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

## 8. Reusable Component Suggestions

*   Verify all date input forms leverage standard date utilities in helper logic.

---

## 9. Accessibility Notes

*   Ensure dates output formats are screen-reader understandable.

---

## 10. Dark Mode Notes

*   Utilities carry no visual styling, but assure formatted strings do not inject unparsed HTML spans.

---

## 11. Performance Notes

*   Import only specific modules (`import { date } from 'quasar'`) to support tree-shaking on compile passes.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Importing Lodash just to capitalize a string or debounce an input.
    *   *Correction:* Use Quasar's native `debounce` and `format.capitalize` helpers.
*   **Anti-Pattern:** Implementing custom regular expressions for phone number verification inside inputs rules.
    *   *Correction:* Call `patterns.testPattern.phone`.

---

## 13. AI Agent Rules

1.  **Reject Moment/Lodash Imports:** Audit code blocks to confirm no third-party string or date frameworks are imported.
2.  **Verify Native Pattern Usage:** Check that input templates utilize pre-tested regex configurations from patterns.

---

## 14. Decision Matrix

| Utility Requirement | Dynamic Context | Recommended Package | Target Method |
| :--- | :--- | :--- | :--- |
| **Convert Date formats**| Date string display | `date` | `date.formatDate(..., 'YYYY/MM/DD')`|
| **Calculate Date diff** | Date range checking | `date` | `date.getDateDiff(..., 'days')` |
| **Email Verification** | Validation rules | `patterns` | `patterns.testPattern.email` |
| **Convert file size** | Document upload status| `format` | `format.humanStorageSize(bytes)` |

---

## 15. Final Rule

All date parsing calculations, string format updates, input regex matching, and DOM height inquiries must use Quasar's native lightweight utilities instead of third-party libraries.
