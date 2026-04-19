## ARCHITECTURE RULES (STRICT)

1. SERVICES LAYER:

* ALL API requests MUST exist ONLY inside services

* ALL IndexedDB (IDB) operations MUST exist ONLY inside services

* Services act as pure data providers (API/IDB gateway)

* Services MUST NOT contain business logic

* Services MUST implement data transformation (mapping) if needed

* Services MUST return standardized response:
  { success: boolean, data: any, error: any }

* All offline/online sync, queue handling, and persistence logic MUST be handled ONLY inside services

* Ensure NO duplication or conflicting sync logic

* Ensure existing sync flow is preserved and improved (NOT broken)

* Logging must be implemented inside services for critical operations

* Logging must be controlled via environment variable (e.g., process.env.ENABLE_LOGS)

    * Must support enabling/disabling logs without code changes

---

2. STORES (Pinia):

* Stores can use services
* Stores can use other stores
* Stores are the SINGLE SOURCE OF TRUTH for application data
* Stores manage:

    * State population from API
    * State hydration from IDB
* No direct API/IDB logic outside services

---

3. COMPOSABLES:

* Can use stores
* Can use other composables
* MUST NOT use services directly
* MUST NOT perform API/IDB operations
* ALL business logic must live here
* Logic must be split into SMALL reusable composables
* Avoid large or monolithic composables

---

4. COMPONENTS:

* Can ONLY use composables
* MUST NOT use:

    * services
    * stores directly
    * API calls
    * IDB operations
* MUST NOT contain business logic
* MUST be thin UI layers only

---

5. SIDE EFFECT RULE:

* Only stores and composables may contain side effects
* Components must remain side-effect free

---

6. LOGIC DISTRIBUTION:

* ALL business logic MUST be in composables
* Ensure no duplication of logic across composables/stores
* Ensure proper separation of concerns

---

7. COMPONENT DESIGN:

* Components must be minimal
* Only responsible for:

    * UI rendering
    * connecting composables
* No heavy logic inside components

---

8. STYLING RULES:

* Prefer Quasar utility classes
* Shared styles → move to css/custom.scss
* Ensure custom.scss is imported globally via app.scss
* Component styles ONLY if:

    * strictly component-specific
    * not reusable anywhere else

---

9. NAMING CONVENTIONS (ENFORCE):

* Stores: useXStore
* Composables: useX
* Services: XService

Refactor any violations.

---

10. FILE SIZE RULE:

* No file should exceed ~400 lines
* If exceeded → must be split logically

---

11. REFACTOR FREEDOM:
    You are allowed to:

* Move code across layers
* Split files
* Merge files
* Create new files (services/composables/stores/components)
* Delete unnecessary or redundant files

Optimize for:

* clarity
* maintainability
* scalability
* strict architecture compliance

---

## REVIEW INSTRUCTIONS

1. Analyze the FULL codebase (ALL files)
2. Enforce ALL rules strictly
3. Identify:

    * Architecture violations
    * Misplaced logic
    * Direct API/IDB usage outside services
    * Incorrect layer usage
    * Sync/queue inconsistencies or duplication
    * Missing logging or improper logging control
    * Missing standardized service responses
    * Naming violations
    * Large files needing split
    * Styling violations
4. Be EXTREMELY STRICT
5. Do NOT modify code
6. Produce ONLY structured report

---

## OUTPUT FORMAT (STRICT)

### 1. Overall Architecture Health

* Rating: Excellent / Good / Moderate / Poor
* Key Problems Summary
* Risk Level

---

### 2. Global Violations

(List repeated issues across the codebase)

---

### 3. File-by-File Action Plan

For EACH affected file:

File: <full path>

Current Issue:

* <exact violation>

Required Action:

* <clear actionable fix>

Refactor Type:

* Move / Split / Merge / Delete / Create

Target Location:

* <where code should go>

Priority:

* High / Medium / Low

---

### 4. New Files to be Created

(List required new services/composables/stores/components)

---

### 5. Files to be Removed or Merged

(List unnecessary or redundant files)

---

### 6. Step-by-Step Refactoring Plan

Provide SAFE execution steps:

1. Step 1
2. Step 2
3. Step 3

---

## IMPORTANT RULES

* Mention EVERY affected file explicitly
* Do NOT skip files
* Do NOT give generic advice
* Output must be directly executable by developers
* Focus ONLY on actionable tasks
* Preserve existing working flow while improving structure
* DO NOT break current sync/data flow

---

## FINAL GOAL

Transform the codebase into a strictly layered, scalable, maintainable architecture with clean separation of concerns, consistent data flow, and zero ambiguity.
