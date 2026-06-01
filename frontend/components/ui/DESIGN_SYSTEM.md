# DevPilot UI — Design System Reference

The single source of truth for shared UI lives in **`components/ui/`** and is
re-exported from the barrel **`@/components/ui`**. Import primitives from the
barrel, never from sibling copies.

```ts
import { Button, DataCard, MetricCard, Badge, Dialog, LoadingState } from "@/components/ui";
```

---

## 1. Tone system (the foundation)

All color semantics flow from one union and one class map in
[`StatusBadge.tsx`](./StatusBadge.tsx):

```ts
export type StatusTone = "success" | "warning" | "critical" | "info" | "neutral" | "ai";
export const toneClasses: Record<StatusTone, string>; // tone → border/bg/text classes
```

Two legacy vocabularies still exist in some modules and **map onto** the canonical
union via `toStatusTone()`:

| Legacy source            | Legacy tones                              | Canonical mapping              |
| ------------------------ | ----------------------------------------- | ------------------------------ |
| `admin/DataView.tsx`     | `brand · success · warning · danger · info · neutral` | `brand → ai`, `danger → critical` |
| `features/*/primitives`  | `ai · success · warning · danger · info · neutral`    | `danger → critical` (`ai` keeps) |

```ts
import { toStatusTone } from "@/components/ui";
<Badge tone={toStatusTone(localTone)}>…</Badge>
```

**Rule:** new code uses `StatusTone` directly. `danger` is spelled **`critical`**;
`brand` is spelled **`ai`**.

---

## 2. The ten primitives

### `Button`
`variant: primary | secondary | danger | ghost` · `size: sm | md | lg` · `isLoading`
— plus all native button attrs. Accessible focus ring, disabled handling.

### `Card` (+ `CardHeader`)
Low-level surface. `<Card>` is a padded bordered `<section>`; `<CardHeader title
description action />` is the simple header. For titled data containers prefer
**`DataCard`**.

### `DataCard` ★ new
The canonical titled container — supersedes `Panel`, `Section`, `SectionCard`,
`DataSection`, `SettingsCard`.

```tsx
<DataCard
  title="Traces" count={128} countLabel="matching"
  icon={<Icon name="activity" />} tone="ai"
  actions={<Button size="sm" variant="secondary">Export</Button>}
  footer={<Pager … />}
  padded={false}            // flush body for tables/lists
  accentBorder              // optional toned left rule
>
  …
</DataCard>
```

### `Modal`
Low-level overlay primitive: focus-trap, Esc-to-close, scroll-lock,
`role="dialog"`. Props: `isOpen · onClose · title · footer · children`.

### `Dialog` ★ new
Semantic dialog built on `Modal` — confirm / alert / prompt.

```tsx
<Dialog
  isOpen={open} onClose={close}
  title="Delete workspace" tone="critical" icon={<Icon name="trash" />}
  description="This permanently removes all documents and vectors."
  confirm={{ label: "Delete", variant: "danger", isLoading: saving, onClick: del }}
/>
```
`ConfirmDialog` is a thin preset over this for the common destructive case.

### `Badge`
Tone pill. `tone: StatusTone` · optional `icon` · `size: sm | md`. Domain badges
(`StatusBadge`, `RoleBadge`, quality/risk/health) are presets over `Badge` +
`StatusBadge.statusTone()`.

### `Tabs`
`items: {id,label}[] · activeId · onChange`. `role="tablist"` semantics.

### `EmptyState`
`title · description? · icon? · action?`. Dashed-border centered panel.

### `LoadingState` ★ new
One entry point for all loading UI.

```tsx
<LoadingState variant="spinner" />                       // centered section load
<LoadingState variant="inline" label="Saving…" />        // row/button
<LoadingState variant="skeleton" rows={6} skeletonVariant="card" />
<LoadingState variant="overlay" />                       // scrim over a relative panel
```
`LoadingSkeleton` remains the low-level placeholder used by the `skeleton` variant.

### `MetricCard`
KPI tile — supersedes `StatCard`, `MetricStrip` items, `MetricTrendCard`.

```tsx
<MetricCard
  label="Avg faithfulness" hint="last 24h" value="84%"
  tone="success" icon={<Icon name="shield" />}
  delta={{ value: "+3.1pts", direction: "up" }}
  href="/admin/rag-traces"
/>
```
The minimal `{ label, value, detail }` form is preserved (backwards compatible).

---

## 3. Conventions

- **Tokens only** — `bg-canvas/surface/sunken/hover`, `text-fg/-muted/-subtle`,
  `border-line/-line-strong`, `bg-brand`, status families. Never raw hex.
- **Responsive** — every flex/grid child gets `min-w-0`; no horizontal scroll at
  1366 / 1600 / 1920.
- **A11y** — real headings, labelled controls, `focus-visible:ring-focus`,
  `tabular-nums` for figures, decorative icons `aria-hidden`.
