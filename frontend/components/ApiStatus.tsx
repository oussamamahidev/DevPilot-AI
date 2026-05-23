"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingState } from "@/components/LoadingState";
import { API_BASE_URL } from "@/lib/api-client";
import { useApiStatus } from "@/hooks/useApiStatus";

export function ApiStatus() {
  const { data, error, isLoading } = useApiStatus();

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">API status</h2>
          <p className="mt-1 text-sm text-slate-500">{API_BASE_URL}</p>
        </div>
        {data ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
            {data.status}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {isLoading ? <LoadingState label="Checking connection" /> : null}
        {error ? <ErrorMessage message={error} /> : null}
        {data ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Service</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {data.service ?? data.app ?? "DevPilot AI API"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Environment</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {data.environment ?? "development"}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
