# Little Leap AQL

**Project Overview:** A complete digital transformation system for Little Leap—the "brain" (AQL) of the company. It manages UAE-based baby product distribution, tracking the full workflow from import to sale, including warehouse management, outlet distribution, sales tracking, invoicing, payments, and reporting.

**Business Model:** Products are displayed on stands in pharmacies where customers purchase directly; Little Leap collects sales data and payments monthly. The startup is partner-run (friends & family) with no dedicated staff yet; a second sales staff will join after the full-stack developer (10-15 years in PHP, Vue.js, Laravel, MySQL). 

## Technical Stack
- **Frontend:** Quasar Framework (Vue.js-based) for Material Design UI, PWA capability (native mobile feel), pre-built components, and role-based dynamic rendering. 

- **Backend:** Google Sheets as database with Google Apps Script APIs (doGet/doPost for CRUD); modular, reusable functions; potential migration to BigQuery for scale. 

- **Development:** AI-assisted via Google Antigravity using Markdown prompts; model options like Claude Opus or Gemini Flash. 


## Data Structure
Organized into four Google Sheets files:

**File 1: MASTERS** (partially exists)
- Products, Warehouses, Outlets, other masters as needed. 

**File 2: APP** (configuration)
- Resources (entities list with auto-timestamps).
- Users (ID, Name, Email, Password Hash).
- Roles (ID, Name, Description; e.g., Administrator, Sales, Developer, Partner).
- User_Roles (many-to-many mapping).
- Role_Resources/RolePermissions (Role ID, Resource, Permissions: Read/Write/Update/Delete). 


**File 3: TRANSACTIONS**
- Shipments (from China), Invoices, Sales, Payments, Stock movements, other transactions.
- Archiving: Yearly backups to manage size; move historical data to archive sheets. 

**File 4: REPORTS**
- Invoice templates (auto-fill formulas), Delivery notes, Financial reports, Sales summaries.
- Exports: PDF generation. 


All tables include audit fields: Created By/At, Updated By/At (auto-generated via Apps Script `new Date()`, user from login session). 

## Core Requirements
**Digitalization:** End-to-end control of imports, shipments, stock, sales, invoicing, payments, delivery notes via one app. 


**User Access Management:** Role-based access control (RBAC); users have multiple roles; granular per-resource permissions (Read/Write/Delete/Update); login checks roles for UI/resources. 

**Data Management:** Full CRUD via Apps Script; auto-timestamps/audit; archiving prevents bloat. 


**Exports/Reporting:** PDF from templates; customer/internal reports. 

## Development Approach
1. Antigravity generates code: Sheets schema, Apps Script (common CRUD), Quasar frontend (mobile-accessible (PWA)).
2. Ensure intuitive UI for varying technical literacy; scalable design. 


## Challenges
- Partners' varying tech skills; mobile accessibility; growth handling; archiving strategy. 


## Next Steps
1. Finalize Sheets structure (add user sheets to APP).
2. Core Apps Script functions.
3. Quasar frontend. 
