import { getRuvixBridge } from "./bridge";

export interface VectorStoreConfig {
  storeId: string;
  dimensions: number;
  capacity: number;
  groupId: string;
}

export interface VectorStoreStats {
  storeId: string;
  vectorCount: number;
  dimensions: number;
  capacity: number;
  groupId: string;
}

export interface VectorEntry {
  key: number;
  data: number[];
  metadata: Record<string, unknown>;
  groupId: string;
}

export interface VectorSearchResult {
  key: number;
  distance: number;
  metadata: Record<string, unknown>;
}

export interface GraphStoreConfig {
  storeId: string;
  maxNodes: number;
  maxEdges: number;
  groupId: string;
}

export interface GraphStoreStats {
  storeId: string;
  nodeCount: number;
  edgeCount: number;
  groupId: string;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  groupId: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  properties: Record<string, unknown>;
  groupId: string;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function createVectorStore(
  config: VectorStoreConfig
): Promise<VectorStoreStats> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/vectors/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: config.storeId,
      dimensions: config.dimensions,
      capacity: config.capacity,
      group_id: config.groupId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create vector store: ${response.statusText}`);
  }

  const data = await response.json();
  return data.store;
}

export async function vectorPut(
  storeId: string,
  key: number,
  data: number[],
  metadata: Record<string, unknown>,
  groupId: string
): Promise<{ stored: boolean; key: number }> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/vectors/put", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      key,
      data,
      metadata,
      group_id: groupId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to put vector: ${response.statusText}`);
  }

  return response.json();
}

export async function vectorSearch(
  storeId: string,
  query: number[],
  limit: number
): Promise<VectorSearchResult[]> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/vectors/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      query,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to search vectors: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results;
}

export async function createGraphStore(
  config: GraphStoreConfig
): Promise<GraphStoreStats> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/graphs/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: config.storeId,
      max_nodes: config.maxNodes,
      max_edges: config.maxEdges,
      group_id: config.groupId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create graph store: ${response.statusText}`);
  }

  const data = await response.json();
  return data.store;
}

export async function createNode(
  storeId: string,
  nodeId: string,
  labels: string[],
  properties: Record<string, unknown>,
  groupId: string
): Promise<{ created: boolean; nodeId: string }> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/graphs/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      node_id: nodeId,
      labels,
      properties,
      group_id: groupId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create node: ${response.statusText}`);
  }

  return response.json();
}

export async function createEdge(
  storeId: string,
  edgeId: string,
  source: string,
  target: string,
  relationType: string,
  properties: Record<string, unknown>,
  groupId: string
): Promise<{ created: boolean; edgeId: string }> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/graphs/edges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      edge_id: edgeId,
      source,
      target,
      relation_type: relationType,
      properties,
      group_id: groupId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create edge: ${response.statusText}`);
  }

  return response.json();
}

export async function graphQuery(
  storeId: string,
  nodeLabels?: string[],
  relationType?: string,
  limit: number = 100
): Promise<GraphQueryResult> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/graphs/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      node_labels: nodeLabels,
      relation_type: relationType,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to query graph: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

export async function deleteVectorStore(storeId: string): Promise<boolean> {
  const bridge = getRuvixBridge();
  
  const response = await fetch(
    `http://127.0.0.1:9001/v1/vectors/stores/${storeId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete vector store: ${response.statusText}`);
  }

  const data = await response.json();
  return data.deleted === true;
}

export async function deleteGraphStore(storeId: string): Promise<boolean> {
  const bridge = getRuvixBridge();
  
  const response = await fetch(
    `http://127.0.0.1:9001/v1/graphs/stores/${storeId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete graph store: ${response.statusText}`);
  }

  const data = await response.json();
  return data.deleted === true;
}
