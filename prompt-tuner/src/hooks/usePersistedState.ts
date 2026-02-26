"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useState that persists to localStorage.
 * Reads from storage on mount, writes on every change.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch { /* ignore quota errors */ }
  }, [key, state]);

  return [state, setState];
}

/**
 * Persisted Set<string> — stored as a JSON array in localStorage.
 */
export function usePersistedSet(key: string, defaultValue: string[]): [Set<string>, (updater: (prev: Set<string>) => Set<string>) => void] {
  const [state, setState] = usePersistedState<string[]>(key, defaultValue);
  const set = new Set(state);

  const setSet = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setState((prev) => {
      const next = updater(new Set(prev));
      return [...next];
    });
  }, [setState]);

  return [set, setSet];
}
