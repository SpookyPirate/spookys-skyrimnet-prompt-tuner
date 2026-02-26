import { create } from "zustand";
import type { TriggerYaml, SimulatedEvent, TriggerMatchResult } from "@/types/yaml-configs";
import { matchTriggers } from "@/lib/triggers/matcher";

interface TriggerState {
  triggers: TriggerYaml[];
  eventHistory: SimulatedEvent[];
  lastMatchResults: TriggerMatchResult[];

  loadTriggers: (promptSet: string) => Promise<void>;
  fireEvent: (event: SimulatedEvent) => void;
  clearEventHistory: () => void;
  setTriggers: (triggers: TriggerYaml[]) => void;
}

export const useTriggerStore = create<TriggerState>((set, get) => ({
  triggers: [],
  eventHistory: [],
  lastMatchResults: [],

  loadTriggers: async (promptSet: string) => {
    try {
      const res = await fetch(`/api/triggers/list?promptSet=${encodeURIComponent(promptSet)}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ triggers: data.triggers || [] });
    } catch {
      // Silently fail
    }
  },

  fireEvent: (event: SimulatedEvent) => {
    const state = get();
    const results = matchTriggers(event, state.triggers, state.eventHistory);
    set((s) => ({
      eventHistory: [...s.eventHistory, event],
      lastMatchResults: results,
    }));
  },

  clearEventHistory: () => set({ eventHistory: [], lastMatchResults: [] }),

  setTriggers: (triggers) => set({ triggers }),
}));
