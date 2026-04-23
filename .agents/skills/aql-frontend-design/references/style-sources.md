# AQL Frontend Style Sources

Read only the files needed for the current task. Use this reference to decide where the existing design language already lives before adding anything new.

## Mandatory rule source

- `Documents/ARCHITECTURE RULES.md`
  - Read first for any work under `FRONTENT/`.
  - Enforce Quasar-first styling and shared-style priority.

## Shared entry points

- `FRONTENT/src/css/app.scss`
  - Confirms the global import order: `hero`, `transitions`, then `custom`.
- `FRONTENT/src/css/custom.scss`
  - Default extension point for new reusable shared styles.
- `FRONTENT/src/css/transitions.scss`
  - Reusable transition classes for page and wizard motion.
- `FRONTENT/src/css/quasar.variables.scss`
  - Brand palette, surface colors, ink hierarchy, radius scale, and typography tokens.

## Hero design system

- `FRONTENT/src/css/hero.scss`
  - Shared hero system entry point.
- `FRONTENT/src/css/hero/_tokens.scss`
  - CSS variables and shared hero design tokens derived from Quasar variables.
- `FRONTENT/src/css/hero/_index-hero.scss`
  - Hero shell, section-card, group-header, and card-grid patterns.
- `FRONTENT/src/css/hero/_hero-card.scss`
  - Shared hero card treatments.
- `FRONTENT/src/css/hero/_hero-items-action.scss`
  - Hero item/action styling.
- `FRONTENT/src/css/hero/_sidebar.scss`
  - Sidebar-oriented hero styling.
- `FRONTENT/src/css/hero/_index-wizard.scss`
  - Wizard/index page visual patterns.
- `FRONTENT/src/css/hero/_wizard-controls.scss`
  - Wizard control styling.

## How to use these sources

1. Start with Quasar built-in components and Quasar utility classes.
2. Borrow existing hero/shared classes if the requested design matches their vocabulary.
3. Add new shared CSS only when the pattern is generic and reusable.
4. Keep page-specific styling local to the page/component when it is not reusable.
5. Prefer extending the current design language over inventing a separate one.
