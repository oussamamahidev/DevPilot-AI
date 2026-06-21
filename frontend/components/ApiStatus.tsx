"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { API_BASE_URL } from "@/lib/api-client";
import { useApiStatus } from "@/hooks/useApiStatus";

export function ApiStatus() {
  const { data, error, isLoading } = useApiStatus();

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-fg">API status</h2>
          <p className="mt-1 text-sm text-fg-subtle">{API_BASE_URL}</p>
        </div>
        {data ? <StatusBadge label={data.status} tone="success" /> : null}
      </div>

      <div className="mt-4">
        {isLoading ? <LoadingState label="Checking connection" /> : null}
        {error ? <ErrorMessage message={error} /> : null}
        {data ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-fg-subtle">Service</dt>
              <dd className="mt-1 font-medium text-fg">
                {data.service ?? data.app ?? "DevPilot AI API"}
              </dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Environment</dt>
              <dd className="mt-1 font-medium text-fg">{data.environment ?? "development"}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
