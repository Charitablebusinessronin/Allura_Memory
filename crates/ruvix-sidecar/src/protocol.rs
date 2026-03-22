use serde::{Deserialize, Serialize};

/// IPC message types exchanged between TypeScript and Rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcMessage {
    // Health and diagnostics
    Ping { timestamp: u64 },
    
    // Event recording (Phase 2)
    RecordEvent {
        event_id: String,
        event_type: String,
        agent_id: String,
        group_id: String,
        workflow_id: Option<String>,
        metadata: serde_json::Value,
        timestamp: String,
        proof_tier: ProofTier,
    },
    
    // Insight operations (Phase 2)
    CreateInsight {
        insight_id: String,
        group_id: String,
        summary: String,
        confidence: f64,
        trace_ref: String,
        entities: Vec<String>,
        proof_tier: ProofTier,
    },
    
    // Graph operations
    GraphApply {
        operation: GraphOperation,
        data: serde_json::Value,
        proof: Option<Proof>,
    },
    
    // Capability management (Phase 3)
    GrantCapability {
        target: String,
        capability: Capability,
    },
    
    RevokeCapability {
        target: String,
        capability_id: String,
    },
    
    // Checkpoint operations (Phase 4)
    CreateCheckpoint {
        label: String,
    },
    
    RestoreCheckpoint {
        checkpoint_id: String,
    },
    
    // Query operations
    QueryEvents {
        group_id: String,
        event_type: Option<String>,
        limit: u32,
    },
    
    QueryInsights {
        group_id: String,
        min_confidence: Option<f64>,
        limit: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProofTier {
    Reflex,   // <10µs - high frequency events
    Standard, // ~100µs - normal operations
    Deep,     // ~1ms - security critical
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    pub tier: ProofTier,
    pub hash: String,
    pub signature: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphOperation {
    CreateNode,
    CreateEdge,
    UpdateNode,
    SupersedeNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    EventCreate { group_id: String },
    EventRead { group_id: String },
    InsightCreate { group_id: String },
    InsightPromote { group_id: String },
    InsightSupersede { group_id: String },
    SystemCheckpoint,
    SystemReplay,
    PolicyModify,
}

/// IPC response from Rust sidecar to TypeScript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcResponse {
    pub request_id: u64,
    pub status: ResponseStatus,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    Ok,
    Error { code: String, message: String },
    ProofRequired,
    CapabilityDenied,
}
