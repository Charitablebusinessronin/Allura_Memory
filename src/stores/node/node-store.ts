import { createStore } from "zustand/vanilla";

export type NodeState = {
  selectedNodeId: string | null;
  hoverNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setHoverNodeId: (id: string | null) => void;
  clearSelection: () => void;
};

export const createNodeStore = () =>
  createStore<NodeState>()((set) => ({
    selectedNodeId: null,
    hoverNodeId: null,
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setHoverNodeId: (id) => set({ hoverNodeId: id }),
    clearSelection: () => set({ selectedNodeId: null, hoverNodeId: null }),
  }));
