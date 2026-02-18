# Little Leap AQL Documentation

Welcome to the technical documentation for the Little Leap AQL project. This folder contains detailed guides on the system's logic, architecture, and setup.

## Latest Development Updates
- 2026-02-18: Profile management expanded to support `updateName`, `updateEmail`, and `updatePassword` from the frontend Profile page, with matching token-protected handlers in `GAS/auth.gs`.
- 2026-02-18: Auth API internals refactored to use row-based token validation context and centralized JSON request/response helpers.
- 2026-02-18: Ground-level inbound operations from China to Ajman warehouse documented for implementation alignment.
- 2026-02-18: AI collaboration protocol added for handling Sheet/App Script/code/doc synchronization.

## Documentation Index

### 1. [Overview](OVERVIEW.md)
*   **Context:** High-level introduction to the project goals, business model, and tech stack.
*   **Audience:** All stakeholders.

### 2. [Business Logic](BusinessLogic.md)
*   **Context:** Detailed explanation of the entities (Products, Warehouses) and workflows (Import -> Sale).
*   **Audience:** Developers, Project Managers.

### 3. [Technical Specifications](TechnicalSpecifications.md)
*   **Context:** Deep dive into the codebase, API contracts, JSON structures, and security implementation.
*   **Audience:** Backend/Frontend Developers.

### 4. [System Architecture](Architecture.md)
*   **Context:** Diagrams and component breakdown showing how Quasar, Apps Script, and Sheets interact.
*   **Audience:** System Architects, Lead Developers.

### 5. [Frontend Setup](QUASAR_SETUP.md)
*   **Context:** Step-by-step guide to setting up the Quasar development environment.
*   **Audience:** Frontend Developers.

### 6. [Database Structure](APP_SHEET_STRUCTURE.md)
*   **Context:** Schema definition for the Google Sheets used as the database.
*   **Audience:** DB Admins, Backend Developers.

### 7. [Ground Operations Workflow](GROUND_OPERATIONS_WORKFLOW.md)
*   **Context:** Real-world inbound logistics flow (China -> UAE port -> Ajman warehouse), and feature roadmap tied to field operations.
*   **Audience:** Developers, Operations, Future joiners (AI/Person).

### 8. [AI Collaboration Protocol](AI_COLLABORATION_PROTOCOL.md)
*   **Context:** Rules for keeping Google Sheets, Apps Script, local code, and docs synchronized during implementation.
*   **Audience:** AI Agents, Developers, Project Owner.
