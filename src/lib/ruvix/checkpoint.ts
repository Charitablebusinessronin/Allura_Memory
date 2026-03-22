import { getRuvixBridge } from "./bridge";

export interface CheckpointRequest {
  label?: string;
  groupId: string;
  eventCount: number;
  lastEventId?: string;
}

export interface Checkpoint {
  checkpointId: string;
  label?: string;
  groupId: string;
  eventCount: number;
  lastEventId?: string;
  createdAt: number;
  createdBy?: string;
  stateHash: string;
  witnessLogCount: number;
}

export interface ReplayResult {
  success: boolean;
  eventsReplayed: number;
  lastEventId?: string;
  error?: string;
}

export async function createCheckpoint(
  request: CheckpointRequest
): Promise<Checkpoint> {
  const bridge = getRuvixBridge();
  
  const response = await fetch("http://127.0.0.1:9001/v1/checkpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: request.label,
      group_id: request.groupId,
      event_count: request.eventCount,
      last_event_id: request.lastEventId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create checkpoint: ${response.statusText}`);
  }

  const data = await response.json();
  return data.checkpoint;
}

export async function replayCheckpoint(
  checkpointId: string
): Promise<ReplayResult> {
  const bridge = getRuvixBridge();
  
  const response = await fetch(
    `http://127.0.0.1:9001/v1/checkpoints/${checkpointId}/replay`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpoint_id: checkpointId }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to replay checkpoint: ${response.statusText}`);
  }

  return response.json();
}

export async function recordEventWithWitness(
  eventId: string,
  groupId: string,
  proofTier: "reflex" | "standard" | "deep"
): Promise<{ witnessId: string; proofHash: string }> {
  const bridge = getRuvixBridge();
  
  const eventData = {
    event_id: eventId,
    group_id: groupId,
    timestamp: new Date().toISOString(),
  };
  
  const proof = await bridge.generateProof(eventData, proofTier);
  
  return {
    witnessId: `wit-${Date.now()}`,
    proofHash: proof.hash,
  };
}
