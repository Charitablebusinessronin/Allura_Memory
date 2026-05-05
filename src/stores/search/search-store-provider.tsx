"use client";

import { createContext, useContext, useState } from "react";

import { type StoreApi, useStore } from "zustand";

import { createSearchStore, type SearchState } from "./search-store";

const SearchStoreContext = createContext<StoreApi<SearchState> | null>(null);

export const SearchStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState<StoreApi<SearchState>>(() => createSearchStore());

  return <SearchStoreContext.Provider value={store}>{children}</SearchStoreContext.Provider>;
};

export const useSearchStore = <T,>(selector: (state: SearchState) => T): T => {
  const store = useContext(SearchStoreContext);
  if (!store) throw new Error("Missing SearchStoreProvider");
  return useStore(store, selector);
};
