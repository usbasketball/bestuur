"use client";

import { useEffect, useState } from "react";

type Result<T> = { path: string; data: T | null; error: string | null };

export function useApiData<T>(path: string) {
  const [result, setResult] = useState<Result<T>>({ path, data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    fetch(path, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then((json) => {
        if (!cancelled) setResult({ path, data: json, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({ path, data: null, error: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const fresh = result.path === path;
  return {
    data: fresh ? result.data : null,
    error: fresh ? result.error : null,
    loading: !fresh,
  };
}