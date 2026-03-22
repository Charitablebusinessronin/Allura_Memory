import { createVectorStore, vectorPut, vectorSearch, VectorStoreConfig } from "./vector-graph";
import { createGraphStore, createNode, createEdge, graphQuery, GraphStoreConfig } from "./vector-graph";
import { getRuvixBridge } from "./bridge";
import { getPool } from "@/lib/postgres/connection";

export interface EventVector {
  eventId: string;
  eventType: string;
  agentId: string;
  groupId: string;
  timestamp: string;
  metadataHash: string;
}

export interface InsightGraph {
  insightId: string;
  groupId: string;
  summary: string;
  entities: string[];
  traceRef: string;
}

export async function initializeVectorStores(): Promise<void> {
  const groups = ["faith-meats", "difference-driven", "patriot-awning", "global"];
  
  for (const groupId of groups) {
    try {
      await createVectorStore({
        storeId: `events-${groupId}`,
        dimensions: 384,
        capacity: 10000,
        groupId,
      });
      
      await createVectorStore({
        storeId: `insights-${groupId}`,
        dimensions: 768,
        capacity: 5000,
        groupId,
      });
    } catch (error) {
      console.error(`Failed to create vector stores for ${groupId}:`, error);
    }
  }
}

export async function initializeGraphStores(): Promise<void> {
  const groups = ["faith-meats", "difference-driven", "patriot-awning", "global"];
  
  for (const groupId of groups) {
    try {
      await createGraphStore({
        storeId: `knowledge-${groupId}`,
        maxNodes: 50000,
        maxEdges: 200000,
        groupId,
      });
    } catch (error) {
      console.error(`Failed to create graph stores for ${groupId}:`, error);
    }
  }
}

export async function indexEventVector(event: EventVector): Promise<void> {
  const storeId = `events-${event.groupId}`;
  
  const embedding = await generateEventEmbedding(event);
  
  await vectorPut(
    storeId,
    parseInt(event.eventId.split("-")[1] || "0"),
    embedding,
    {
      eventType: event.eventType,
      agentId: event.agentId,
      timestamp: event.timestamp,
    },
    event.groupId
  );
}

export async function searchSimilarEvents(
  groupId: string,
  queryEvent: Partial<EventVector>,
  limit: number = 10
): Promise<Array<{ eventId: string; distance: number }>> {
  const storeId = `events-${groupId}`;
  const query = await generateEventEmbedding(queryEvent as EventVector);
  
  const results = await vectorSearch(storeId, query, limit);
  
  return results.map(r => ({
    eventId: `evt-${r.key}`,
    distance: r.distance,
  }));
}

export async function createInsightGraph(
  insight: InsightGraph
): Promise<void> {
  const storeId = `knowledge-${insight.groupId}`;
  
  await createNode(
    storeId,
    insight.insightId,
    ["Insight"],
    {
      summary: insight.summary,
      confidence: 0.85,
      traceRef: insight.traceRef,
    },
    insight.groupId
  );
  
  for (const entity of insight.entities) {
    await createNode(
      storeId,
      entity,
      ["Entity"],
      {},
      insight.groupId
    ).catch(() => {});
    
    await createEdge(
      storeId,
      `edge-${insight.insightId}-${entity}`,
      insight.insightId,
      entity,
      "ABOUT",
      {},
      insight.groupId
    );
  }
}

export async function queryKnowledgeGraph(
  groupId: string,
  entityTypes?: string[],
  limit: number = 100
): Promise<{ nodes: Array<{ id: string; labels: string[] }>; edges: Array<{ source: string; target: string; type: string }> }> {
  const storeId = `knowledge-${groupId}`;
  const result = await graphQuery(storeId, entityTypes, undefined, limit);
  
  return {
    nodes: result.nodes.map(n => ({ id: n.id, labels: n.labels })),
    edges: result.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.relationType,
    })),
  };
}

async function generateEventEmbedding(event: EventVector | Partial<EventVector>): Promise<number[]> {
  const text = `${event.eventType}:${event.agentId}:${event.groupId}:${JSON.stringify(event.metadataHash || {})}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  const embedding = hashArray.slice(0, 384).map(b => (b / 255) * 2 - 1);
  
  while (embedding.length < 384) {
    embedding.push(0);
  }
  
  return embedding.slice(0, 384);
}

export async function syncPostgresToVector(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      "SELECT event_id, event_type, agent_id, group_id, metadata FROM events ORDER BY created_at DESC LIMIT 1000"
    );
    
    for (const row of result.rows) {
      await indexEventVector({
        eventId: row.event_id,
        eventType: row.event_type,
        agentId: row.agent_id,
        groupId: row.group_id,
        timestamp: new Date().toISOString(),
        metadataHash: JSON.stringify(row.metadata || {}),
      });
    }
  } finally {
    client.release();
  }
}

export async function syncNeo4jToGraph(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      "SELECT insight_id, group_id, summary, entities, trace_ref FROM neo4j_insights_pending LIMIT 500"
    );
    
    for (const row of result.rows) {
      await createInsightGraph({
        insightId: row.insight_id,
        groupId: row.group_id,
        summary: row.summary,
        entities: Array.isArray(row.entities) ? row.entities : JSON.parse(row.entities || "[]"),
        traceRef: row.trace_ref,
      });
    }
  } finally {
    client.release();
  }
}
