# DEPRECATED — AQL Frontend Sidebar Menu & Access Control

> **This init prompt has been replaced.** Use `frontend_menu_system.md` instead — it is the single authoritative initialization prompt for all frontend sidebar menu tasks.

## Why This Was Replaced

The old prompt required agents to read multiple separate files (`AQL_MENU_ADMIN_GUIDE.md §9`, `resourceRegistry.gs`, `useMainLayoutNavTree.js`, `useMenuAccess.js`). The new approach consolidates everything into a single canonical document:

- `Documents/AQL_FRONTEND_MENU_SYSTEM.md` — Complete end-to-end documentation
- `References/Prompt Library/Initialization/frontend_menu_system.md` — Single init prompt covering everything

## What to Use Instead

Load **`frontend_menu_system.md`** for any task involving:
- Adding, removing, reordering, or modifying sidebar menu entries
- Changing `menuAccess` permission gates
- Debugging menu visibility or route guard issues
- Implementing new features that touch the menu system

---

*Kept for backward compatibility. Will be removed after all agents are transitioned to `frontend_menu_system.md`.*
