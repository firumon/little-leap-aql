---
name: aql-frontend-design
description: Design or refine AQL frontend pages, Quasar components, resource views, page sections, standalone Quasar prototypes, interaction mockups, or implementation-ready UI changes while preserving the repo's frontend architecture, shared CSS, and Quasar-first design system.
---

# AQL Frontend Design

## Role Of This Skill

Use this skill for AQL-specific frontend design judgment. It complements the canonical docs; it does not replace them.

Canonical authority order:
1. `AGENTS.md` / `CLAUDE.md`.
2. `Documents/MULTI_AGENT_PROTOCOL.md`.
3. `Documents/DOC_ROUTING.md`.
4. `Documents/ARCHITECTURE RULES.md` for any `FRONTENT/` edit.
5. `references/style-sources.md` in this skill for local style discovery.

If this skill conflicts with the canonical docs, follow the docs.

## Required Reads

Before touching any file under `FRONTENT/`:
1. Read `Documents/ARCHITECTURE RULES.md`.
2. Read `Documents/AI_COLLABORATION_PROTOCOL.md` when implementing, not just discussing.
3. Read `references/style-sources.md` when making visual/design changes.
4. Read only the specific frontend files and registries required by `Documents/DOC_ROUTING.md`.

## Current Design Baseline

- AQL is a Quasar-first operational app, not a marketing site.
- Prefer dense, scannable, work-focused layouts over decorative pages.
- Use Quasar components and utility classes before custom markup or CSS.
- Reuse existing shared CSS and tokens before adding new styling.
- Keep page files thin; put reusable UI in components and state/business flow in composables.
- Preserve IndexedDB, Pinia, service worker, and API boundaries.

## Design Priority Order

1. Existing page/component pattern.
2. Quasar components.
3. Quasar utility classes.
4. Existing shared CSS from the sources listed in `references/style-sources.md`.
5. Component-local CSS for genuinely local styling.
6. New shared CSS or reusable components only when the pattern is generic and likely to repeat.

## Architecture Guardrails

- Do not put API calls, IndexedDB work, store orchestration, or business rules in UI components.
- Use approved composables/services for navigation, data flow, and resource workflows.
- Use `useResourceNav` for feature navigation where the architecture requires it.
- Update `FRONTENT/src/components/REGISTRY.md` or `FRONTENT/src/composables/REGISTRY.md` only when reusable interfaces change.
- Avoid page-specific selectors in shared CSS.
- Keep mobile, loading, empty, and error states coherent when the workflow naturally needs them.

## Output Modes

- Standalone prototype: use only when the user asks for a demo/mockup/prototype outside the app. Keep it Quasar-based and close to AQL styling.
- Implementation-ready UI: edit real project files and follow the frontend architecture rules.
- Reusable building block: create or update shared components/composables only when reuse is clear.

## Design Deliverables

For design/prototype tasks, deliver the smallest complete surface that satisfies the request:
- responsive layout
- realistic states
- working interactions when requested
- project-native Quasar structure
- minimal new CSS or component surface
