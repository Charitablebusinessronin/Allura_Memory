import { getRuvixBridge } from "@/lib/ruvix/bridge";
import { getPool } from "@/lib/postgres/connection";

async function checkNotionApproval(insightId: string): Promise<{
  aiAccessible: boolean;
  reviewStatus: string;
}> {
  // TODO: Implement actual Notion API check for HITL approval
  // For now, returns a mock response
  return {
    aiAccessible: true,
    reviewStatus: "Completed",
  };
}

export interface InsightPromotionRequest {
  insightId: string;
  groupId: string;
  summary: string;
  confidence: number;
  traceRef: string;
  entities: string[];
}

export interface PromotionResult {
  success: boolean;
  insightId?: string;
  error?: string;
  proofVerified?: boolean;
  hitlApproved?: boolean;
}

export async function promoteInsightWithProof(
  request: InsightPromotionRequest
): Promise<PromotionResult> {
  const bridge = getRuvixBridge();
  
  if (!bridge.isConnected()) {
    return {
      success: false,
      error: "RuVix bridge not connected",
    };
  }
  
  try {
    const approval = await checkNotionApproval(request.insightId);
    
    if (!approval.aiAccessible) {
      return {
        success: false,
        error: `Insight ${request.insightId} requires human approval before promotion`,
        hitlApproved: false,
      };
    }
    
    const insightData = {
      insight_id: request.insightId,
      group_id: request.groupId,
      summary: request.summary,
      confidence: request.confidence,
      trace_ref: request.traceRef,
      entities: request.entities,
    };
    
    const proof = await bridge.generateProof(insightData, "deep");
    
    const verification = await bridge.verifyProof(insightData, proof, "deep");
    
    if (!verification.valid) {
      return {
        success: false,
        error: `Proof verification failed: ${verification.error}`,
        proofVerified: false,
        hitlApproved: true,
      };
    }
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      const neo4jResult = await client.query(
        `INSERT INTO neo4j_insights_pending 
         (insight_id, group_id, summary, confidence, trace_ref, entities, proof_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          request.insightId,
          request.groupId,
          request.summary,
          request.confidence,
          request.traceRef,
          JSON.stringify(request.entities),
          proof.hash,
        ]
      );
      
      await client.query(
        `INSERT INTO witness_logs 
         (event_id, group_id, proof_tier, proof_hash, proof_signature, 
          proof_timestamp, proof_nonce, data_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          request.insightId,
          request.groupId,
          "deep",
          proof.hash,
          proof.signature,
          new Date(proof.timestamp * 1000).toISOString(),
          proof.nonce,
          proof.hash,
        ]
      );
      
      await client.query("COMMIT");
      
      return {
        success: true,
        insightId: request.insightId,
        proofVerified: true,
        hitlApproved: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during promotion",
    };
  }
}

export async function isPromotionReady(insightId: string): Promise<{
  ready: boolean;
  aiAccessible: boolean;
  reviewStatus: string;
}> {
  const approval = await checkNotionApproval(insightId);
  return {
    ready: approval.aiAccessible && approval.reviewStatus === "Completed",
    aiAccessible: approval.aiAccessible,
    reviewStatus: approval.reviewStatus,
  };
}
