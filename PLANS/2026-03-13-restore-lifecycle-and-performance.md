# PLAN: Restore Environment and Fix UI/UX Lifecycle Issues
**Status**: IN_PROGRESS
**Created**: 2026-03-13
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Restore the `idb` library to its official state, fix the hanging login redirection, enable logout across all pages, and resolve the 10+ second reloading issue in master pages by properly utilizing IndexedDB cache.

## Step 1: Restore Official Library (Environmental Fix)
- Command: `npm install idb@latest --force`
- Goal: Replace corrupted files in `node_modules` with original official code.
- Reset `db.js` to avoid using any "repaired" Class names that don't exist in official `idb`.

## Step 2: Fix Master Page Reload Performance
- **Issue**: Data wipes out and reloads from server every time the user switches pages.
- **Root Cause**: `MasterEntityPage.vue`'s `reload()` function isn't reading from IDB correctly during navigation.
- **Fix**: 
    1. Ensure `MasterEntityPage.vue` retrieves cached items immediately when the slug changes.
    2. Background sync should only trigger if cache is stale or missing.
**Files**: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`

## Step 3: Fix Logout across Master/Warehouse Pages
- **Issue**: Logout button fails on specific pages.
- **Fix**: 
    1. Wrap `db.close()` and deletion logic in robust error handlers in `db.js`.
    2. Ensure `auth.logout()` handles router navigation as the very first step to prevent getting stuck in a page that's trying to access a closing DB.
**Files**: `FRONTENT/src/utils/db.js`, `FRONTENT/src/stores/auth.js`

## Step 4: Fix Login Redirection
- **Issue**: Login completes but doesn't redirect to Dashboard until manual reload.
- **Fix**: 
    1. Move `reinitializeDB()` out of the awaited login path if necessary to avoid deadlock.
    2. Ensure `LoginPage.vue` handles the redirection explicitly after the store confirms success.
**Files**: `FRONTENT/src/pages/AuthPage/LoginPage.vue`, `FRONTENT/src/stores/auth.js`

## Step 5: Verification
- Verify IDB persistence across page switches.
- Verify Logout from Products page works.
- Verify Login redirects instantly to Dashboard.
