# 07 — Screenshots Package

This document specifies the screenshot capture plan for the DevPilot AI report. For every page in the application, it records the page objective, the user actions that lead to the captured state, the expected result, and a placeholder marking where the screenshot must be inserted.

> Note: Image placeholders are intentional. No screenshots are fabricated; each placeholder must be replaced with a real capture taken against the running application.

---

## Landing

**Page objective.** Present the product, its value proposition, and entry points to authentication.

**User actions.** Navigate to the application root URL.

**Expected result.** The landing page renders with product messaging and clear calls to action linking to Login and Register.

> 📸 [SCREENSHOT PLACEHOLDER: Landing]

---

## Login

**Page objective.** Authenticate an existing user.

**User actions.** Enter email and password, then submit the login form.

**Expected result.** On valid credentials the user is authenticated, a JWT is stored client-side, and the user is redirected to the dashboard. Invalid credentials surface an inline error.

> 📸 [SCREENSHOT PLACEHOLDER: Login]

---

## Register

**Page objective.** Create a new user account.

**User actions.** Fill in the registration fields and submit.

**Expected result.** A new account is created with a hashed password, and the user proceeds to an authenticated session.

> 📸 [SCREENSHOT PLACEHOLDER: Register]

---

## Dashboard (role-aware: personal + admin)

**Page objective.** Provide a role-aware landing surface after login, showing personal content for standard users and additional administrative content for admins.

**User actions.** Log in and land on the dashboard; observe content differences depending on role.

**Expected result.** Standard users see their personal dashboard; administrators additionally see admin-oriented panels. Content is gated by RBAC.

> 📸 [SCREENSHOT PLACEHOLDER: Dashboard role-aware (personal + admin)]

---

## Documents

**Page objective.** Manage workspace documents and monitor ingestion.

**User actions.** Upload documents (including drag-and-drop and batch upload), then observe the document list and processing status.

**Expected result.** Uploaded documents appear in the list with their processing status reflecting the asynchronous ingestion pipeline.

> 📸 [SCREENSHOT PLACEHOLDER: Documents]

---

## Chat (streaming + citations)

**Page objective.** Let users ask questions and receive grounded, streamed answers.

**User actions.** Type a question and submit; watch the answer stream in.

**Expected result.** The answer streams progressively via real SSE token delivery, with `[n]` citation markers and the supporting sources displayed.

> 📸 [SCREENSHOT PLACEHOLDER: Chat (streaming + citations)]

---

## Workspace

**Page objective.** Manage workspace membership and scope user access.

**User actions.** View the active workspace and its associated documents/members.

**Expected result.** Workspace details render, and access is isolated so the user only sees workspaces they belong to.

> 📸 [SCREENSHOT PLACEHOLDER: Workspace]

---

## Settings

**Page objective.** Manage user-level and application preferences.

**User actions.** Open Settings and review/adjust available options.

**Expected result.** Settings render and reflect the authenticated user's configuration.

> 📸 [SCREENSHOT PLACEHOLDER: Settings]

---

## Admin Overview

**Page objective.** Give administrators a high-level view of platform statistics.

**User actions.** As an admin, navigate to the admin overview.

**Expected result.** Admin statistics render. The page is accessible only to users with the admin role (RBAC-gated).

> 📸 [SCREENSHOT PLACEHOLDER: Admin Overview]

---

## Admin Quality

**Page objective.** Surface answer-quality metrics for administrative review.

**User actions.** As an admin, open the quality view.

**Expected result.** Quality metrics (e.g., faithfulness, relevance, context precision, hallucination) are presented for oversight.

> 📸 [SCREENSHOT PLACEHOLDER: Admin Quality]

---

## RAGOps Control Tower

**Page objective.** Provide operational monitoring of RAG health and pipelines.

**User actions.** As an admin, open the RAGOps Control Tower.

**Expected result.** Health and pipeline status views render, giving operators an overview of the RAG system's operational state.

> 📸 [SCREENSHOT PLACEHOLDER: RAGOps Control Tower]

---

## RAGOps Workspace/Document detail

**Page objective.** Drill into the RAG operational state for a specific workspace or document.

**User actions.** From the Control Tower, select a workspace or document to inspect.

**Expected result.** A detail view renders the pipeline/health information scoped to the selected workspace or document.

> 📸 [SCREENSHOT PLACEHOLDER: RAGOps Workspace/Document detail]

---

## RAG Trace Observatory

**Page objective.** List RAG interaction traces for observability.

**User actions.** Open the Trace Observatory and browse/filter the list of traces.

**Expected result.** A list of traces renders, each entry linking to its detailed inspection view.

> 📸 [SCREENSHOT PLACEHOLDER: RAG Trace Observatory]

---

## AI Trace Inspector

**Page objective.** Provide a deep, end-to-end inspection of a single RAG interaction.

**User actions.** Select a trace from the Observatory to open its detail.

**Expected result.** A 9-section detail view renders, following the chain `message → agent_runs → retrieved_chunks → evaluations`.

> 📸 [SCREENSHOT PLACEHOLDER: AI Trace Inspector]

---

## AI Execution Studio

**Page objective.** Showcase the live execution of the agentic RAG pipeline.

**User actions.** Submit a query and watch the pipeline animate stage by stage.

**Expected result.** A 10-stage animated pipeline, driven by real SSE events with an animated avatar, visualizes execution in real time.

> 📸 [SCREENSHOT PLACEHOLDER: AI Execution Studio]

---

## Architecture Explorer (+ component page)

**Page objective.** Present an interactive map of the system architecture and let users inspect individual components.

**User actions.** Open the Architecture Explorer, observe the live flow, select a node to open the inspector, and navigate into a per-component page.

**Expected result.** A React Flow architecture map renders with live flow; selecting a node opens the inspector; per-component pages provide component-level detail.

> 📸 [SCREENSHOT PLACEHOLDER: Architecture Explorer (map + node inspector)]

> 📸 [SCREENSHOT PLACEHOLDER: Architecture Explorer component page]

---

## Admin Users

**Page objective.** Administer platform users.

**User actions.** As an admin, view, create, update, and delete users.

**Expected result.** User CRUD operations function and the user list reflects changes. Access is RBAC-gated to admins.

> 📸 [SCREENSHOT PLACEHOLDER: Admin Users]

---

## Admin Audit Logs

**Page objective.** Review the platform's audit trail.

**User actions.** As an admin, open the audit logs view.

**Expected result.** Audit log entries render for administrative review.

> 📸 [SCREENSHOT PLACEHOLDER: Admin Audit Logs]
