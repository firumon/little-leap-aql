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
- Project Name: `little-leap-aql`
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

## Development Workflow
- **Development Server:** Run `npm run dev` inside the `FRONTENT` directory to start the Quasar development server (default port: 9000).
- **Build for Production:** Run `quasar build` to generate the production-ready distribution.

## Key Files for AI Agents
- `FRONTENT/package.json`: Project dependencies and scripts.
- `FRONTENT/quasar.config.js`: Quasar-specific settings.
- `FRONTENT/src/css/quasar.variables.scss`: UI branding colors.
- `FRONTENT/src/boot/axios.js`: API communication setup.
