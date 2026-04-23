---
name: aql-frontend-design
description: Design and prototype AQL frontend pages, sections, and reusable components using Quasar-first patterns, existing shared CSS, and the repository's frontend architecture rules. Use when Codex is asked to create or refine a page layout, component design, UI/UX prototype, standalone HTML demo, interaction mockup, hero-style surface, or implementation-ready Quasar frontend output for this project.
---

# AQL Frontend Design

## Overview

Use this skill to produce frontend design work that looks and behaves like AQL, not a generic Vue mockup. Start from Quasar components, Quasar utility classes, and the repository's shared style system before introducing new abstractions.

## Required Startup Reads

1. Read `Documents/ARCHITECTURE RULES.md` before touching anything in `FRONTENT/`.
2. Read `references/style-sources.md`.
3. Read only the specific frontend files needed for the task after those two reads.

## Design Priorities

Follow this order unless the user explicitly asks otherwise:

1. Use Quasar built-in components for structure and behavior.
2. Use Quasar utility classes for spacing, layout, typography, color, and visibility.
3. Reuse existing shared CSS from `src/css/hero`, `src/css/transitions.scss`, and `src/css/custom.scss`.
4. Add a new reusable Quasar component only when the requirement cannot be met cleanly with existing Quasar pieces and shared styles.
5. Add new shared CSS only when the requirement cannot be solved with Quasar utilities or existing shared classes.

## Output Modes

Choose the lightest mode that satisfies the request.

- `Standalone Quasar prototype`
  - Use a single HTML file only when the user asks for a standalone prototype, demo, or quick interaction mockup.
  - Keep it Quasar-based and close to AQL styling vocabulary.
  - Use mock data for dynamic lists, tabs, drawers, dialogs, hide/show sections, filters, and hover/click transitions.
- `Implementation-ready frontend output`
  - Use real project files when the user wants the design to be integrated or safely portable into AQL.
  - Keep pages thin, move logic out of components, and preserve the architecture layers.
- `Reusable building block`
  - Create or update a shared component only when the UI pattern is clearly reusable across multiple pages or resources.

## Architecture Guardrails

Treat these as mandatory:

- Keep components UI-only. Do not place API access, IndexedDB work, store orchestration, or business logic in components.
- Use composables for business logic and stores only through approved architecture paths.
- Use `useResourceNav` instead of direct `router.push()` in feature flows.
- Keep styling aligned with the architecture priority order:
  1. Quasar utility classes
  2. shared styles
  3. component-local styles
- Keep files under the file-size rule. Split large page work into sections and reusable blocks before a file becomes unwieldy.

## Shared Style Policy

- Reuse existing hero classes and tokens before inventing new ones.
- Treat `src/css/hero` as the shared hero design language already available to the project.
- Treat `src/css/transitions.scss` as the first place to look for page transition patterns.
- Treat `src/css/custom.scss` as the default extension point for new reusable shared styles.
- When adding new shared CSS, use generic class names that describe the pattern, not a page, resource, or feature name.
- Never create page-specific or resource-specific selectors in shared CSS files.
- Put page-specific or component-specific styling only inside the owning component/page file when it is truly local and not reusable.
- Derive new shared styling from existing Quasar variables and design tokens. Do not hardcode a competing design language.

## Prototype Rules

When designing a page or component:

1. Identify the closest existing shared visual language from the style sources.
2. Prefer composition of Quasar components such as `q-page`, `q-card`, `q-toolbar`, `q-tabs`, `q-table`, `q-list`, `q-item`, `q-dialog`, `q-drawer`, `q-btn`, `q-chip`, `q-banner`, `q-skeleton`, and `q-form`.
3. Use Quasar classes such as spacing, flex/grid helpers, typography helpers, and color helpers before adding CSS.
4. Add interactions with Vue state plus existing transition classes when possible.
5. Build dynamic lists with representative mock data when the request is a prototype.
6. Include realistic states: default, hover, active, loading, empty, error, and dense/mobile if relevant.
7. Keep the result easy to migrate into the current Quasar app without layout or token drift.

## When New Shared UI Is Allowed

Create a new shared component or shared style primitive only when all of these are true:

- The requirement cannot be met cleanly with Quasar components, Quasar classes, and existing shared CSS.
- The pattern is generic and likely reusable in future frontend work.
- The naming can remain domain-neutral.
- The addition does not weaken the architecture boundaries.

If those conditions are not met, keep the work local to the owning page/component.

## Naming Rules

- Use generic names for shared classes, helpers, and shared components.
- Avoid names tied to a specific resource, page slug, or business module in shared CSS.
- Keep resource-specific naming only inside the local page/component that owns that behavior.

## Deliverables

For design/prototype requests, aim to provide:

- a working visual layout
- interactive states such as click, hover, collapse, reveal, tabbing, filtering, or drawer/dialog behavior when requested
- responsive structure for desktop and mobile
- clear reuse of project-native Quasar and shared style primitives
- only the smallest necessary amount of new shared CSS or shared component surface

## Prompt Patterns

This skill should trigger for prompts like:

- "Design a Quasar prototype for this page"
- "Create a standalone HTML UI mockup for AQL"
- "Improve the layout/UX of this component"
- "Create a hero-style operations dashboard"
- "Build a clickable page prototype with Quasar components"
- "Redesign this section without breaking the current Quasar design system"
