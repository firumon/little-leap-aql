# Technical Specifications

This document details the technical implementation of the Little Leap AQL system, including authentication, API structure, and frontend-backend integration.

## 1. Architecture Overview

The system follows a **Serverless** architecture using Google's ecosystem:

* **Frontend:** Quasar Framework (Vue.js 3 + Vite) PWA.
* **Backend:** Google Apps Script (GAS) published as a Web App.
* **Database:** Google Sheets (Relational data modeled in sheets).

## 2. Authentication & Security

### User Identity
* **Credential Storage:** User data is stored in the `Users` sheet.
* **Password Handling:** Passwords are never stored in plain text. They are hashed with SHA-256.
* **Login Flow:**
  1. Frontend sends email and password to GAS `doPost`.
  2. GAS verifies password hash.
  3. GAS generates/stores a UUID token in `ApiKey` and returns user profile.

### Stateless API Authentication
* **Token-Based:** All protected actions include `token`.
* **Validation:** `validateToken(token)` resolves the exact user row and returns context (`rowNumber`, sheet, indexes, user data).
* **Benefit:** Update actions avoid scanning all rows repeatedly.

## 3. API Design (Google Apps Script)

All requests are handled via `doPost(e)`.

### Request Format
```json
{
  "action": "functionName",
  "token": "user-auth-token",
  "otherFields": "action-specific payload"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Optional message",
  "...": "action-specific payload"
}
```

### Global Request/Response Helpers
* `parseRequestPayload(e)`: central request JSON parsing.
* `jsonResponse(payload)`: central JSON response generator.

### Implemented Auth Actions (as of 2026-02-18)
* `login`
* `getProfile`
* `updateAvatar`
* `updateName`
* `updateEmail`
* `updatePassword`

## 4. Frontend Implementation

### Stack
* **Quasar CLI with Vite**
* **Pinia** for state management
* **Axios** for HTTP calls to GAS

### Auth Store Pattern
`src/stores/auth.js` now uses a shared API helper:
* `callAuthApi(action, payload, requireAuth)`

This reduces repeated Axios setup (`URL`, headers, token-injection pattern) across actions.

### Profile Management
`src/pages/ProfilePage/ProfilePage.vue` provides dialogs to update:
* Avatar
* Name
* Email
* Password

`src/stores/auth.js` actions:
* `updateAvatar(avatarUrl)`
* `updateName(name)`
* `updateEmail(email)`
* `updatePassword(currentPassword, newPassword)`

## 5. PWA & Offline Capabilities

* **Service Worker:** Workbox-based caching.
* **Local Persistence:** IndexedDB/localStorage support for cached data and queued operations.

## 6. Data Persistence (Google Sheets)

### Optimization
* Header/index mapping is reused per request context.
* Token validation returns direct row context for writes.
* `getRange(row, col)` updates are used for profile field updates.
