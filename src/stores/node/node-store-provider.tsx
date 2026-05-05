"use client";

import { createContext, useContext, useState } from "react";

import { type StoreApi, useStore } from "zustand";

import { createNodeStore, type NodeState } from "./node-store";

export const NodeStoreContext = createContext<StoreApi<NodeState> | null>(null);

export const NodeStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState(() => createNodeStore());

  return <NodeStoreContext.Provider value={store}>{children}</NodeStoreContext.Provider>;
};

export const useNodeStore = <T,>(selector: (state: NodeState) => T): T => {
  const store = useContext(NodeStoreContext);
  if (!store) throw new Error("Missing NodeStoreProvider");
  return useStore(store, selector);
};
