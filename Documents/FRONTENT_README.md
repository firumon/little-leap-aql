# Quasar Application Setup Documentation

This document serves as a guide for AI agents and developers to understand the setup and configuration of the Quasar application in this project.

## Project Overview
- **Framework:** Quasar Framework v2
- **Build Tool:** Vite (@quasar/app-vite)
- **Language:** JavaScript (Vanilla)
- **API:** Vue 3 Composition API
- **State Management:** Pinia
- **Routing:** Vue Router (History mode)
- **HTTP Client:** Axios

## Setup Steps Taken

### 1. Project Initialization
The project was initialized using the Quasar CLI with:
- Project Name: `little-leap-aql`
- Quasar v2 (Vue 3)
- Composition API
- Vite
- JavaScript

### 2. Dependency Configuration
Key dependencies:
- `axios`
- `pinia`
- `vue-router`

### 3. Theme & Branding
Configured colors from `Colors.txt`:
- **Primary:** `#E44072`
- **Secondary:** `#61ACC3`
- **Background:** `#F1F1F3`

Configured at:
- `f:\LITTLE LEAP\AQL\FRONTENT\src\css\quasar.variables.scss`

### 4. Boot Files
`src/boot/axios.js` is configured via `quasar.config.js`.

### 5. Project Structure (Frontend)
Frontend source is in `FRONTENT/src`:
- `boot/`
- `css/`
- `layouts/`
- `pages/`
- `stores/`
- `utils/`

## Layout & Navigation
Main shell is in `MainLayout.vue` with grouped ERP navigation and profile menu.

## Profile Feature Progress (2026-02-18)
`src/pages/ProfilePage/ProfilePage.vue` supports:
- Avatar update
- Name update
- Email update
- Password update

Store/API wiring:
- `src/stores/auth.js` uses shared `callAuthApi(...)` for all auth API actions.
- Profile update actions call GAS: `updateAvatar`, `updateName`, `updateEmail`, `updatePassword`.
- `GAS/auth.gs` validates token and resolves row context once, then performs direct row updates.

## Development Workflow
- Run `npm run dev` in `FRONTENT` (port 9000).
- Keep routes synced with pages.
- Keep docs updated for onboarding continuity.
