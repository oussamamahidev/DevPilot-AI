# 01 — Project Overview

## 1. Identity

**Project name:** DevPilot AI

**Type:** Production-grade **Agentic RAG (Retrieval-Augmented Generation) platform** for software engineering teams.

**One-line definition:** Private, multi-workspace document intelligence with enterprise observability (RAGOps), full traceability, automatic answer evaluation, and flagship visualizations that make the AI reasoning pipeline fully transparent.

DevPilot AI is not a thin wrapper around a chat model. It is a complete, layered system that turns an organization's own knowledge base into a queryable, auditable, and observable intelligence service. Every answer the platform produces is backed by a documented chain of reasoning: which agent ran, what it received, what it returned, how long it took, which document chunks it retrieved, and how the final answer scored under automatic evaluation.

---

## 2. Goal

The goal of DevPilot AI is to give software engineering organizations a **trustworthy, transparent, and self-hosted question-answering system** grounded in their **own** documents — design docs, runbooks, architecture decision records, internal wikis, API references, onboarding material — rather than in the opaque, public training corpus of a generic chatbot.

Three properties define the goal:

1. **Grounded.** Answers are constructed from the organization's private knowledge base via retrieval, not hallucinated from a model's parametric memory.
2. **Transparent.** The entire reasoning pipeline is exposed. Users and operators can inspect exactly how an answer was produced, agent by agent, chunk by chunk.
3. **Operable.** The platform treats RAG as a production system with first-class observability — latency, token usage, evaluation scores, error rates — through a dedicated control surface (RAGOps).

---

## 3. The Problem It Solves

Modern engineering teams accumulate enormous amounts of institutional knowledge spread across documents, wikis, and tickets. Two failure modes dominate:

### 3.1 Knowledge is inaccessible at the moment of need

Information exists, but engineers cannot find it quickly. Keyword search returns too much or too little. Tribal knowledge lives in the heads of a few senior engineers. New hires take months to become productive because answers are scattered.

### 3.2 Generic AI assistants are untrustworthy for internal knowledge

General-purpose chatbots like ChatGPT have two structural problems for enterprise use:

- **They don't know your knowledge.** They were trained on public data and have never seen your internal architecture, your runbooks, or your decisions.
- **They are opaque.** When they do answer, there is no way to verify *why* they said what they said, *where* the information came from, or *whether* it is reliable. There is no citation chain, no per-step trace, no evaluation score.

For an engineering organization, an answer you cannot trace is an answer you cannot trust. A confidently wrong answer about a deployment procedure or a security configuration is worse than no answer at all.

DevPilot AI solves both problems simultaneously: it grounds answers in the organization's **own** documents and exposes **complete transparency** over the reasoning that produced them.

---

## 4. Main Value & Differentiator vs ChatGPT

The core differentiator is summarized in a single sentence:

> **Organizations use their OWN knowledge base with COMPLETE transparency of the reasoning pipeline.**

| Dimension | ChatGPT (generic assistant) | DevPilot AI |
|---|---|---|
| Knowledge source | Public training corpus | The organization's own private documents |
| Data boundary | Sent to a third party | Private, self-hostable, workspace-isolated |
| Grounding | Parametric memory (hallucination-prone) | Retrieval over indexed documents |
| Transparency | Opaque single response | Full per-agent trace, retrieved chunks, citations |
| Quality signal | None | Automatic evaluation score per answer |
| Operability | None for the consumer | RAGOps control tower, metrics, traces |
| Multi-tenancy | N/A | Multi-workspace isolation with RBAC |

The value is therefore not "another chat box." It is **trust through transparency** over **private knowledge**.

---

## 5. Target Users

DevPilot AI is designed for software engineering teams and the roles around them:

- **Software engineers** who need fast, grounded answers about internal systems, APIs, and procedures.
- **New hires / onboarding engineers** who need to ramp up on a codebase and its conventions without constantly interrupting senior staff.
- **Tech leads and architects** who want a queryable, traceable interface over architecture decisions and design documentation.
- **Platform / DevOps engineers** who operate the system and need observability over its behavior (the RAGOps audience).
- **Engineering managers and administrators** who manage workspaces, membership, and access via role-based control (`user`, `admin`, `super_admin`).

The platform supports these audiences through **multi-workspace** organization: each workspace is an isolated knowledge domain with its own documents, members, and conversations.

---

## 6. High-Level Capability Summary

DevPilot AI provides the following end-to-end capabilities:

- **Multi-workspace document intelligence.** Users belong to workspaces; each workspace holds its own documents, conversations, and members.
- **Asynchronous document ingestion.** Documents are uploaded and processed in the background (parsing, chunking, embedding, indexing) without blocking the user.
- **Semantic + hybrid retrieval.** Queries are answered by retrieving relevant chunks using both semantic (vector) and keyword signals, with reranking.
- **Agentic RAG reasoning.** A seven-agent workflow (router → query rewriter → retrieval → reranker → generator → evaluator → corrector) processes each question.
- **Real token streaming.** Answers stream token-by-token to the user over Server-Sent Events, with structured events for trace, citations, evaluation, and correction.
- **Automatic evaluation.** Each answer is scored automatically and the result is persisted.
- **Full traceability.** Every message links to its agent runs, retrieved chunks, and evaluations, forming an auditable chain.
- **Enterprise observability (RAGOps).** A control tower surfaces metrics, traces, and operational health.
- **Flagship visualizations.** The AI Execution Studio and the Architecture Explorer make the pipeline and the system architecture visually explorable in real time.
- **Authentication and RBAC.** JWT-based authentication with three roles (`user`, `admin`, `super_admin`).

---

## 7. Key Innovations

DevPilot AI's distinctiveness comes from four flagship innovations, all of which are fully built into the platform.

### 7.1 RAGOps — Operating RAG as a Production System

RAGOps is the discipline (and the in-product surface) of treating Retrieval-Augmented Generation as a first-class production system rather than a demo. The **RAGOps Control Tower** centralizes operational visibility over the platform: it exposes the metrics, traces, and health signals needed to run RAG reliably at scale.

This reframes RAG from "a feature" into "a system with operations," bringing the same observability culture that exists for microservices (metrics, traces, dashboards) to the AI reasoning layer. Prometheus and Grafana provide the metrics backbone; the control tower provides the product surface.

### 7.2 Trace Explorer — Full Pipeline Transparency

DevPilot AI exposes two complementary trace surfaces:

- **RAG Trace Observatory** — a list view of executions across the platform, giving operators a fleet-level view of what the system has been doing.
- **AI Trace Inspector** — a nine-section detail view that lets a user or operator drill into a single execution and see the complete reasoning: the agents that ran, their inputs and outputs, latencies, statuses, the chunks retrieved, the evaluation, and any correction.

Together they make every answer **auditable**. This is the concrete mechanism behind the "complete transparency" differentiator: nothing about how an answer was produced is hidden.

### 7.3 AI Execution Studio — The Pipeline, Visualized Live

The **AI Execution Studio** is a flagship visualization that renders the RAG pipeline as a **ten-stage animated pipeline driven by real Server-Sent Events**, complete with an animated AI avatar. As a real question is processed, the studio animates each stage in lockstep with the actual backend execution — the animation is not a canned demo; it is driven by the live SSE event stream (start, trace, token, citations, evaluation, correction, message, done).

This turns an otherwise invisible, abstract process into something a stakeholder can watch and understand, dramatically improving comprehension and trust.

### 7.4 Architecture Explorer — The System, Made Navigable

The **Architecture Explorer** is an interactive architecture map built with React Flow. It renders the system's components as a graph, animates the **live request flow** across that graph, provides a **clickable node inspector**, and links each component to a **per-component immersive page**. This converts the system's architecture into an explorable, living document rather than a static diagram, valuable both for onboarding and for demonstrating the system to evaluators and stakeholders.

---

## 8. Why These Innovations Matter Together

Individually, grounding, tracing, evaluation, and visualization are each useful. Combined, they produce a property that generic assistants cannot offer: **an answer you can verify**. The user receives not just a response, but the evidence (retrieved chunks and citations), the process (the agent trace), and the quality signal (the evaluation score) behind it. This is the foundation of DevPilot AI's value proposition for engineering organizations: **trust, earned through transparency, over private knowledge.**

---

## 9. Summary

DevPilot AI is a production-grade Agentic RAG platform that lets software engineering organizations query their own private knowledge base with full transparency. Its seven-agent reasoning pipeline, complete traceability chain, automatic evaluation, enterprise observability (RAGOps), and flagship visualizations (AI Execution Studio, Architecture Explorer) together solve the two core failures of generic AI assistants for enterprise use: lack of grounding in private knowledge, and lack of transparency in reasoning.
