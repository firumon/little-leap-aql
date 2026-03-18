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
The project was initialized using the Quasar CLI with the following specifications:
- Project Name: `aql`
- Quasar v2 (Vue 3)
- Composition API
- Vite as the build tool
- JavaScript (no TypeScript)

### 2. Dependency Configuration
The following key dependencies were installed and configured:
- `axios`: For making HTTP requests.
- `pinia`: For centralized state management.
- `vue-router`: For client-side routing.

### 3. Theme & Branding
Custom colors were applied based on the `Colors.txt` file located in the project root.
- **Primary:** `#E44072`
- **Secondary:** `#61ACC3`
- **Background:** `#F1F1F3`

These colors are configured in:
- `f:\LITTLE LEAP\AQL\FRONTENT\src\css\quasar.variables.scss`

### 4. Boot Files
- **Axios:** A boot file `src/boot/axios.js` was created to provide a global Axios instance and a `$api` helper for easier access within components.
- Configured in `quasar.config.js`:
  ```javascript
  boot: [
    'axios'
  ]
  ```

### 5. Project Structure (Frontend)
The frontend code is located in the `FRONTENT` directory:
- `src/boot/`: Contains initialization logic (e.g., Axios).
- `src/css/`: Contains global styles and Quasar variables.
- `src-pwa/`: Contains PWA-specific configurations (the app is configured with PWA support).
- `quasar.config.js`: The main configuration file for the Quasar app.

## Layout & Navigation
Recently, a professional ERP-style layout was implemented in `MainLayout.vue`.

### Header Features
- **Application Title:** "AQL" with a business icon.
- **Search Bar:** A dark-themed search input for quick resource access.
- **Notifications:** A notification bell with a red badge for alerts.
- **Profile Menu:** A dropdown containing Profile, Settings, and Logout options.

### Navigation (Sidebar)
The sidebar navigation is now **dynamic and resource-driven**:
- Menu groups are generated from `resources[].ui.menuGroup` in the authorized login payload.
- Only resources with `permissions.canRead === true` and `showInMenu === true` are shown.
- Current groups (from `syncAppResources.gs`): **Masters**, **Operations**, **Procurement**, **Accounts**.
- Group icons are resolved via a built-in map or fallback to the first resource icon in the group.
- The sidebar supports search filtering via the header search bar.

## Development Workflow
- **Development Server:** Run `npm run dev` inside the `FRONTENT` directory (port 9000).
- **Routing:** All menu items are linked to specific routes (e.g., `/masters/products`). Ensure corresponding pages are created in `src/pages/`.
- **Styling:** Custom SCSS in `MainLayout.vue` ensures a modern "pill" shape for active navigation items.
