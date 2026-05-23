"use client";

import { useCallback, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/errors";

export function useApi<TData>() {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async (request: () => Promise<TData>) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await request();
      setData(response);
      return response;
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    execute,
    isLoading,
    reset,
    setData,
  };
}
