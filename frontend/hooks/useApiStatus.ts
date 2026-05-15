"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { HealthResponse } from "@/types";

type ApiStatusState = {
  data: HealthResponse | null;
  error: string | null;
  isLoading: boolean;
};

export function useApiStatus() {
  const [state, setState] = useState<ApiStatusState>({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadHealth() {
      try {
        const data = await apiGet<HealthResponse>("/health");

        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to reach the API.",
            isLoading: false,
          });
        }
      }
    }

    void loadHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
