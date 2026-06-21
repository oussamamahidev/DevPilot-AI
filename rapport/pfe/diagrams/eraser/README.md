# Eraser architecture diagrams — DevPilot AI

Architecture diagrams authored in **Eraser diagram-as-code** (https://eraser.io).
These are the canonical "architecture" diagrams for the PFE report (the pure-UML
diagrams — use-case, class, sequence, ERD — stay in PlantUML in `../`).

## How to render
1. Open **https://app.eraser.io** → new file → **Diagram as code**.
2. Paste the contents of any `.eraser` file below.
3. Export as **PNG/SVG** and insert it into the report where the matching
   `\eraserfig{...}` placeholder appears.

> Icons: Eraser has a large icon library. If an `[icon: ...]` name isn't found it
> falls back gracefully — tweak names (e.g. `nextjs`, `postgresql`, `redis`,
> `docker`, `prometheus`, `grafana`, `google`) in the editor to taste.

## Files
| File | Diagram | Used in report |
|---|---|---|
| `01-global-architecture.eraser` | Architecture globale (8 services + flux) | Ch.3 §3.1 (`fig:global`) |
| `02-deployment.eraser` | Déploiement Docker Compose | Ch.2 (`fig:deploy`) |
| `03-rag-pipeline.eraser` | Pipeline RAG agentique (7 agents) | Ch.3 §3.6 (`fig:pipe`) |
| `04-ragops.eraser` | Architecture RAGOps | Ch.3 §3.7 |
| `05-traceability.eraser` | Chaîne de traçabilité | Ch.3 §3.8 (`fig:trace`) |
| `06-ai-execution-studio.eraser` | AI Execution Studio (10 étapes) | Ch.3 §3.9 |
| `07-backend-layers.eraser` | Backend en couches | Ch.3 §3.2 |
| `08-component.eraser` | Diagramme de composants | Ch.2 (`fig:comp`) |

The same Eraser code is also embedded in the report's `lstlisting` blocks so the
source is documented alongside each figure.
