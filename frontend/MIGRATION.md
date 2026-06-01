# UI Consolidation — Migration Plan

**Goal:** one design system in `@/components/ui`, zero duplicate implementations.
**Strategy:** consolidate the canonical primitives first (non-breaking), then
migrate call sites module-by-module, then delete the dead duplicates. The build
stays green at every step.

Legend: ✅ done · 🟡 in progress · ⬜ pending

---

## Phase 0 — Canonical system established ✅ (this PR)

The ten requested primitives now have a single home in `components/ui/`:

| Primitive       | File                | Status                                    |
| --------------- | ------------------- | ----------------------------------------- |
| `Button`        | `Button.tsx`        | ✅ canonical (unchanged)                  |
| `Card`          | `Card.tsx`          | ✅ canonical (low-level surface)          |
| `Modal`         | `Modal.tsx`         | ✅ canonical (overlay primitive)          |
| `Dialog`        | `Dialog.tsx`        | ✅ **new** — semantic dialog on Modal     |
| `Badge`         | `Badge.tsx`         | ✅ enhanced (`icon`, `size`)              |
| `Tabs`          | `Tabs.tsx`          | ✅ canonical (unchanged)                  |
| `EmptyState`    | `EmptyState.tsx`    | ✅ canonical (unchanged)                  |
| `LoadingState`  | `LoadingState.tsx`  | ✅ **new** — spinner/inline/skeleton/overlay |
| `DataCard`      | `DataCard.tsx`      | ✅ **new** — titled container             |
| `MetricCard`    | `MetricCard.tsx`    | ✅ enhanced (`tone`, `icon`, `hint`, `delta`, `href`) |

Also landed: `toStatusTone()` tone adapter; `@/components/LoadingState` is now a
deprecated shim; `AnalyticsUI.tsx` carries a deprecation banner. API reference:
[`components/ui/DESIGN_SYSTEM.md`](./components/ui/DESIGN_SYSTEM.md).

Verified: `npm run lint` clean, `npm run build` compiles.

---

## Duplicate map

`AdminUI.tsx` is **not** a duplicate — it is a thin adapter over the canonical
`ui/` primitives (admin-specific prop shapes). It stays. The real targets:

| Duplicate (where)                                   | Canonical replacement                    | Consumers | Risk |
| --------------------------------------------------- | ---------------------------------------- | --------: | ---- |
| `AnalyticsUI.StatusBadge / EmptyState / LoadingSkeleton / PageHeader` | `ui` `StatusBadge` / `EmptyState` / `LoadingState` / `PageHeader` | 6 files | Low |
| `AnalyticsUI.StatCard / MetricTrendCard`            | `ui/MetricCard`                          | 6 files   | Low |
| `AnalyticsUI.DataTable / FilterBar / CitationCard / ProgressRing / PipelineStepper / AgentTimeline` | `ui/DataTable`, `data/FilterBar`, `ai/*`, feature modules | 6 files | Med |
| `AnalyticsUI.*Chart` (Recharts)                     | lightweight tokenized charts (per feature) | 3 files | Med |
| `@/components/LoadingState` (root)                  | `ui/LoadingState` (`variant="inline"`)   | 7 files   | Low |
| `ragops/primitives.SectionCard`                     | `ui/DataCard`                            | 11 files  | Med |
| `trace-inspector/primitives.Panel / Section`        | `ui/DataCard`                            | 6 files   | Med |
| `settings/SettingsCard.SettingsCard / StatusBadge`  | `ui/DataCard` / `ui/StatusBadge`         | 7 files   | Low |
| `DataView.StatusDot / MetricStrip` tone strings     | converge tone via `toStatusTone()`       | 8 files   | Low |
| `data/Pagination / FilterBar / SearchInput`         | `DataView.Pager` / shared filter         | 1 file    | Low |
| Paginations: `data/Pagination`, `DataView.Pager`, `AdminUI.PaginationControls` | pick `DataView.Pager` as canonical | 3 sites | Med |

---

## Phase 1 — Retire the root `LoadingState` shim ⬜  *(Low · 7 files)*

The shim already works; migrate imports so it can be deleted.

```bash
# find them
grep -rl '"@/components/LoadingState"' app components features
```
Replace `import { LoadingState } from "@/components/LoadingState";` with
`import { LoadingState } from "@/components/ui";` (same `{label}` API → inline
variant by default where used in rows; choose `variant="spinner"` for full-section
loads). Then delete `components/LoadingState.tsx`.

## Phase 2 — Converge tones ⬜  *(Low · 8 files)*

In `DataView.tsx` and the feature `primitives.tsx`, replace local `Tone`
literals with `StatusTone` (`danger → critical`, `brand → ai`) or wrap at the
boundary with `toStatusTone()`. After this, every badge/metric shares one
vocabulary and `Badge`/`DataCard`/`MetricCard` can be used directly.

## Phase 3 — Containers → `DataCard` ⬜  *(Med · ~24 sites)*

Migrate `SectionCard` (ragops), `Panel`/`Section` (trace-inspector) and
`SettingsCard` to `DataCard`. Map: `title → title`, header action → `actions`,
section number/icon → `icon`, body → children, `padded={false}` for flush
tables. Keep the feature `primitives.tsx` files until their last consumer moves,
then delete the container exports (leave domain-specific bits like `ScoreBar`,
`AgentStatusChip`).

## Phase 4 — Dismantle `AnalyticsUI.tsx` ⬜  *(Med · 6 files)*

Per consumer (`app/admin/page.tsx`, `app/admin/quality/page.tsx`,
`app/admin/ragops/workspaces/[id]`, `app/admin/ragops/documents/[id]`,
`components/ai/index.ts`, `components/charts/index.ts`):
1. Swap the plain primitives for `@/components/ui` equivalents (Phase-0 names).
2. Move the Recharts charts behind tokenized replacements (the pattern already
   used in the Trace Inspector / Observatory).
3. Delete the migrated exports from `AnalyticsUI.tsx`; remove the file once empty.

## Phase 5 — Unify pagination ⬜  *(Med · 3 sites)*

Adopt `DataView.Pager` as the one pager. Re-point `AdminUI.PaginationControls`
to it (keep its prop shape as an adapter) and delete `data/Pagination.tsx`
(1 consumer).

---

## Codemod helpers

```bash
# import-path sweep (review diffs before committing)
grep -rl '"@/components/LoadingState"' app components features \
  | xargs sed -i 's#from "@/components/LoadingState"#from "@/components/ui"#'

# find every remaining AnalyticsUI symbol still in use
grep -rhoE "AnalyticsUI[^;]*" app components features
```

## Verification (run after every phase)

```bash
cd frontend && npm run lint && npm run build
```
Manually spot-check the touched routes at **1366 / 1600 / 1920** (no horizontal
scroll), light + dark themes, and keyboard focus on interactive primitives.

## Definition of done

- [ ] `components/LoadingState.tsx` deleted
- [ ] `AnalyticsUI.tsx` deleted (charts moved to feature modules)
- [ ] One tone vocabulary (`StatusTone`) across the app
- [ ] Containers use `DataCard`; KPI tiles use `MetricCard`; one `Pager`
- [ ] `grep -r "duplicate-name"` returns a single definition per primitive
