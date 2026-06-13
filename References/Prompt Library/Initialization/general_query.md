# Initialization: General Query

> **Scope boundary**: This document covers general/universal queries only. It instructs you when and how to transition to AQL-aware mode using DOC_ROUTING.md. Self-contained — no other init prompt is needed.

Use this instruction when the user's query is:
1. A general conceptual question (e.g., JS syntax, DB theories, standard accounting) with no initial reference to AQL.
2. A request that starts generally but will transition into alignment with AQL.

---

## 1. Scope Detection

Determine whether the user's query is:
- **Universal / Non-AQL**: A general programming, business, or design question with no reference to AQL → Answer directly from general knowledge. Do not read AQL codebase files or project docs.
- **AQL-Specific**: The user references AQL concepts, resources, sheets, workflows, or code → Transition to AQL-aware mode (see Section 3).

---

## 2. Handling Universal Queries (Non-AQL)

If the user asks a question about general programming, software patterns, business processes, or system design that does not reference AQL:
1. **Answer directly from general knowledge**: Provide a comprehensive, accurate answer.
2. **Do not read AQL codebase files or project docs**: Keep your context clean.

---

## 3. Transition to AQL-Aware Mode (Critical Boundary)

If the user attempts to apply, implement, or align conceptual knowledge with the AQL repository (e.g., "Now, let's implement this design in AQL"):
1. **Consult DOC_ROUTING.md**: Read [DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md) to identify which canonical documents cover the target area.
2. **Read Architecture Rules**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) before any frontend-related work.
3. **Map to AQL Constructs**:
   - Align backend logic with existing Apps Script patterns in [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md).
   - Align frontend logic with the Vue Reactivity Contract (thin pages, logic in composables, state in Pinia stores).
4. **Search the codebase**: Use `grep_search` to locate relevant files and verify alignment before proposing changes.

---

## 4. Guardrails (DOs and DO NOTs)

- **DO NOT** read the entire AQL codebase upfront for a general question.
- **DO NOT** fabricate AQL-specific answers from general knowledge. Always verify against the actual code.
- **DO** transition cleanly to AQL-aware mode when the user shifts context.
- **DO** use [DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md) as the compass for finding relevant AQL documentation.
