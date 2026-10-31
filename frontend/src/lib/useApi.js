"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError } from "@/lib/api/client";

/**
 * Loads data with cancellation of stale requests.
 *   const { data, error, loading, reload, setData } = useApi((signal) => leadsApi.list(query, { signal }), [queryKey]);
 * Pass `null` as the loader to skip loading (e.g. while an id is not known yet).
 * `revalidateOnFocus` refetches quietly when the tab regains focus (used for badges and dashboards).
 */
export function useApi(loader, deps, { revalidateOnFocus = false, keepPrevious = false } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: Boolean(loader) });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const controllerRef = useRef(null);

  const run = useCallback(async ({ quiet = false } = {}) => {
    const current = loaderRef.current;
    if (!current) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!quiet) setState((prev) => ({ data: keepPrevious ? prev.data : undefined, error: null, loading: true }));
    try {
      const data = await current(controller.signal);
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      setState((prev) => ({ data: quiet ? prev.data : undefined, error: quiet ? prev.error : error, loading: false }));
    }
  }, [keepPrevious]);

  useEffect(() => {
    if (!loaderRef.current) {
      setState({ data: undefined, error: null, loading: false });
      return undefined;
    }
    run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!revalidateOnFocus) return undefined;
    const onFocus = () => document.visibilityState === "visible" && run({ quiet: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [revalidateOnFocus, run]);

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
