"use client";

import type { ObservatoryFilters, TriState } from "@/features/trace-observatory/helpers";
import { SearchBox, FilterPills } from "@/components/admin/DataView";
import { Icon } from "@/components/ui/Icon";

type ObservatoryFilterBarProps = {
  filters: ObservatoryFilters;
  onChange: (patch: Partial<ObservatoryFilters>) => void;
  onReset: () => void;
  workspaces: { workspace_id: string; workspace_name: string }[];
  strategies: string[]; // distinct retrieval strategies (filter options)
  users: string[]; // distinct user emails (filter options)
  activeCount: number; // number of active filters (for the Reset button)
};

const parseNum = (v: string): number | null => (v.trim() === "" ? null : Number(v));

const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus";
const NUM_CLASS =
  "h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-focus";
const LABEL_CLASS = "text-xs font-medium text-fg-muted";

export function ObservatoryFilterBar(props: ObservatoryFilterBarProps) {
  const { filters, onChange, onReset, workspaces, strategies, users, activeCount } = props;

  return (
    <div className="grid gap-4 rounded-xl border border-line bg-surface p-4">
      {/* Row 1 — search + reset */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <SearchBox
            value={filters.search}
            onChange={(v) => onChange({ search: v })}
            placeholder="Search traces…"
          />
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="refreshCw" size={15} />
          Reset filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-subtle px-1.5 text-[10px] font-semibold tabular-nums text-brand-fg">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Row 2 — workspace / user / strategy selects */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-workspace" className={LABEL_CLASS}>
            Workspace
          </label>
          <select
            id="obs-workspace"
            className={SELECT_CLASS}
            value={filters.workspaceId}
            onChange={(e) => onChange({ workspaceId: e.target.value })}
          >
            <option value="">All workspaces</option>
            {workspaces.map((w) => (
              <option key={w.workspace_id} value={w.workspace_id}>
                {w.workspace_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-user" className={LABEL_CLASS}>
            User
          </label>
          <select
            id="obs-user"
            className={SELECT_CLASS}
            value={filters.userEmail}
            onChange={(e) => onChange({ userEmail: e.target.value })}
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-strategy" className={LABEL_CLASS}>
            Retrieval strategy
          </label>
          <select
            id="obs-strategy"
            className={SELECT_CLASS}
            value={filters.retrievalStrategy}
            onChange={(e) => onChange({ retrievalStrategy: e.target.value })}
          >
            <option value="">All strategies</option>
            {strategies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3 — metric ranges + date range */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-faith-min" className={LABEL_CLASS}>
            Faithfulness range
          </label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              id="obs-faith-min"
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="min"
              aria-label="Minimum faithfulness"
              className={NUM_CLASS}
              value={filters.minFaithfulness ?? ""}
              onChange={(e) => onChange({ minFaithfulness: parseNum(e.target.value) })}
            />
            <span aria-hidden="true" className="shrink-0 text-fg-subtle">
              –
            </span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="max"
              aria-label="Maximum faithfulness"
              className={NUM_CLASS}
              value={filters.maxFaithfulness ?? ""}
              onChange={(e) => onChange({ maxFaithfulness: parseNum(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-hall-min" className={LABEL_CLASS}>
            Hallucination range
          </label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              id="obs-hall-min"
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="min"
              aria-label="Minimum hallucination"
              className={NUM_CLASS}
              value={filters.minHallucination ?? ""}
              onChange={(e) => onChange({ minHallucination: parseNum(e.target.value) })}
            />
            <span aria-hidden="true" className="shrink-0 text-fg-subtle">
              –
            </span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="max"
              aria-label="Maximum hallucination"
              className={NUM_CLASS}
              value={filters.maxHallucination ?? ""}
              onChange={(e) => onChange({ maxHallucination: parseNum(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-date-from" className={LABEL_CLASS}>
            Date from
          </label>
          <input
            id="obs-date-from"
            type="date"
            aria-label="Date from"
            className={NUM_CLASS}
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
        </div>

        <div className="grid min-w-0 gap-1">
          <label htmlFor="obs-date-to" className={LABEL_CLASS}>
            Date to
          </label>
          <input
            id="obs-date-to"
            type="date"
            aria-label="Date to"
            className={NUM_CLASS}
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </div>
      </div>

      {/* Row 4 — tri-state pill toggles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="grid min-w-0 gap-1">
          <span className={LABEL_CLASS}>Corrected</span>
          <FilterPills
            ariaLabel="Filter by corrected"
            value={filters.corrected}
            options={[
              { value: "", label: "All" },
              { value: "yes", label: "Corrected" },
              { value: "no", label: "Not corrected" },
            ]}
            onChange={(v) => onChange({ corrected: v as TriState })}
          />
        </div>

        <div className="grid min-w-0 gap-1">
          <span className={LABEL_CLASS}>Has citations</span>
          <FilterPills
            ariaLabel="Filter by citations"
            value={filters.hasCitations}
            options={[
              { value: "", label: "Any citations" },
              { value: "yes", label: "Has citations" },
              { value: "no", label: "No citations" },
            ]}
            onChange={(v) => onChange({ hasCitations: v as TriState })}
          />
        </div>
      </div>
    </div>
  );
}
