# REVIEW INSTRUCTIONS

1. Analyze FULL codebase
2. Enforce ALL rules strictly

---

### Identify:

* Architecture violations
* Misplaced logic
* Direct API/IDB usage outside services
* Incorrect layer usage
* Sync/queue duplication
* Missing logging
* Missing standardized responses
* Naming violations
* Oversized files
* Styling violations

---

### RULES

* Be EXTREMELY STRICT
* Do NOT modify code
* Produce structured report only

---

# OUTPUT FORMAT

## 1. Overall Architecture Health

* Rating
* Key Problems
* Risk Level

---

## 2. Global Violations

---

## 3. File-by-File Action Plan

File: `<path>`

* Issue
* Action
* Refactor Type
* Target
* Priority

---

## 4. New Files

---

## 5. Files to Remove/Merge

---

## 6. Refactoring Plan

Step-by-step execution plan

---

# IMPORTANT RULES

* Mention EVERY affected file
* Do NOT skip
* No generic advice
* Output must be actionable
* Preserve current working flow
* DO NOT break sync/data flow

---

# FINAL GOAL

A strictly layered, scalable, maintainable architecture with:

* Clear separation of concerns
* Consistent data flow
* Zero ambiguity
