import { createStore } from "zustand/vanilla";

export type SearchState = {
  query: string;
  activeFilter: string;
  page: number;
  setQuery: (q: string) => void;
  setActiveFilter: (f: string) => void;
  setPage: (p: number) => void;
  reset: () => void;
};

const defaults = { query: "", activeFilter: "all", page: 1 };

export const createSearchStore = () =>
  createStore<SearchState>()((set) => ({
    ...defaults,
    setQuery: (q) => set({ query: q }),
    setActiveFilter: (f) => set({ activeFilter: f }),
    setPage: (p) => set({ page: p }),
    reset: () => set(defaults),
  }));
