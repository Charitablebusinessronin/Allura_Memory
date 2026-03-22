mod ipc;
mod protocol;
mod ring_buffer;
mod proof_engine;
mod checkpoint;
mod capability;

use ipc::{IpcBridge, HealthStatus};
use proof_engine::{ProofEngine, ProofTier, Proof};
use checkpoint::CheckpointManager;
use capability::CapabilityManager;

struct AppState {
    bridge: Arc<Mutex<IpcBridge>>,
    proof_engine: Arc<Mutex<ProofEngine>>,
    checkpoint_manager: Arc<Mutex<CheckpointManager>>,
    capability_manager: Arc<Mutex<CapabilityManager>>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    
    info!("RuVix Sidecar starting...");
    
    let bridge = match IpcBridge::new("/tmp/ruvix_shm").await {
        Ok(b) => {
            info!("IPC bridge created successfully");
            Arc::new(Mutex::new(b))
        }
        Err(e) => {
            error!("Failed to create IPC bridge: {}", e);
            std::process::exit(1);
        }
    };
    
    let proof_engine = Arc::new(Mutex::new(ProofEngine::new()));
    let checkpoint_manager = Arc::new(Mutex::new(CheckpointManager::new()));
    let capability_manager = Arc::new(Mutex::new(CapabilityManager::new()));
    let state = AppState { 
        bridge, 
        proof_engine,
        checkpoint_manager,
        capability_manager,
    };
    
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/health/ruvix", get(ruvix_health))
        .route("/v1/events", post(record_event))
        .route("/v1/proofs/generate", post(generate_proof))
        .route("/v1/proofs/verify", post(verify_proof))
        .route("/v1/checkpoints", post(create_checkpoint))
        .route("/v1/checkpoints/:id/replay", post(replay_checkpoint))
        .route("/v1/capabilities", post(grant_capability))
        .route("/v1/capabilities/:id/revoke", post(revoke_capability))
        .route("/v1/capabilities/verify", post(verify_capability))
        .with_state(Arc::new(state));
    
    let listener = tokio::net::TcpListener::bind("127.0.0.1:9001")
        .await
        .expect("Failed to bind to port 9001");
    
    info!("RuVix sidecar listening on http://127.0.0.1:9001");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed");
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "ruvix-sidecar",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn ruvix_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthStatus>, axum::http::StatusCode> {
    let bridge = state.bridge.lock().await;
    
    match bridge.health_check().await {
        Ok(status) => Ok(Json(status)),
        Err(_) => Err(axum::http::StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn record_event(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    info!("Received event: {:?}", payload);
    
    let group_id = payload.get("group_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");
    
    let capability_token = payload.get("capability_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    let manager = state.capability_manager.lock().await;
    
    let verification = manager.verify(
        capability_token,
        &capability::Capability::EventCreate { group_id: group_id.to_string() },
    );
    
    match verification {
        capability::CapabilityResult::Valid { .. } => {},
        _ => {
            return Json(serde_json::json!({
                "status": "denied",
                "error": "Capability verification failed",
            }));
        }
    }
    
    let proof_tier = payload.get("proof_tier")
        .and_then(|v| v.as_str())
        .unwrap_or("reflex");
    
    let tier = match proof_tier {
        "standard" => ProofTier::Standard,
        "deep" => ProofTier::Deep,
        _ => ProofTier::Reflex,
    };
    
    let data = payload.to_string().into_bytes();
    let engine = state.proof_engine.lock().await;
    
    match engine.generate_proof(&data, tier) {
        Ok(proof) => {
            Json(serde_json::json!({
                "status": "received",
                "event_id": payload.get("event_id").cloned().unwrap_or(serde_json::Value::Null),
                "proof": proof,
            }))
        }
        Err(e) => {
            error!("Failed to generate proof: {}", e);
            Json(serde_json::json!({
                "status": "error",
                "error": e.to_string(),
            }))
        }
    }
}

#[derive(serde::Deserialize)]
struct GenerateProofRequest {
    data: serde_json::Value,
    tier: String,
}

async fn generate_proof(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GenerateProofRequest>,
) -> Json<serde_json::Value> {
    let tier = match req.tier.as_str() {
        "standard" => ProofTier::Standard,
        "deep" => ProofTier::Deep,
        _ => ProofTier::Reflex,
    };
    
    let data = req.data.to_string().into_bytes();
    let engine = state.proof_engine.lock().await;
    
    match engine.generate_proof(&data, tier) {
        Ok(proof) => Json(serde_json::json!({ "proof": proof })),
        Err(e) => Json(serde_json::json!({ "error": e.to_string() })),
    }
}

#[derive(serde::Deserialize)]
struct VerifyProofRequest {
    data: serde_json::Value,
    proof: Proof,
    expected_tier: String,
}

async fn verify_proof(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyProofRequest>,
) -> Json<serde_json::Value> {
    let expected_tier = match req.expected_tier.as_str() {
        "standard" => ProofTier::Standard,
        "deep" => ProofTier::Deep,
        _ => ProofTier::Reflex,
    };
    
    let data = req.data.to_string().into_bytes();
    let engine = state.proof_engine.lock().await;
    let result = engine.verify_proof(&data, &req.proof, expected_tier);
    
    match result {
        proof_engine::ProofResult::Valid { latency_micros } => {
            Json(serde_json::json!({
                "valid": true,
                "latency_micros": latency_micros,
            }))
        }
        proof_engine::ProofResult::Invalid { reason } => {
            Json(serde_json::json!({
                "valid": false,
                "error": reason,
            }))
        }
        proof_engine::ProofResult::TierMismatch { expected, actual } => {
            Json(serde_json::json!({
                "valid": false,
                "error": format!("Tier mismatch: expected {:?}, got {:?}", expected, actual),
            }))
        }
    }
}

#[derive(serde::Deserialize)]
struct CreateCheckpointRequest {
    label: Option<String>,
    group_id: String,
    event_count: u64,
    last_event_id: Option<String>,
}

async fn create_checkpoint(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateCheckpointRequest>,
) -> Json<serde_json::Value> {
    let mut manager = state.checkpoint_manager.lock().await;
    
    match manager.create_checkpoint(
        req.label,
        req.group_id,
        req.event_count,
        req.last_event_id,
        None,
    ) {
        Ok(checkpoint) => Json(serde_json::json!({ "checkpoint": checkpoint })),
        Err(e) => Json(serde_json::json!({ "error": e.to_string() })),
    }
}

#[derive(serde::Deserialize)]
struct ReplayRequest {
    checkpoint_id: String,
}

async fn replay_checkpoint(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ReplayRequest>,
) -> Json<serde_json::Value> {
    let manager = state.checkpoint_manager.lock().await;
    
    match manager.replay_from_checkpoint(&req.checkpoint_id) {
        checkpoint::ReplayResult::Success { events_replayed, last_event_id } => {
            Json(serde_json::json!({
                "success": true,
                "events_replayed": events_replayed,
                "last_event_id": last_event_id,
            }))
        }
        checkpoint::ReplayResult::Failed { reason, events_replayed } => {
            Json(serde_json::json!({
                "success": false,
                "error": reason,
                "events_replayed": events_replayed,
            }))
        }
    }
}

#[derive(serde::Deserialize)]
struct GrantCapabilityRequest {
    capability: capability::Capability,
    granted_to: String,
    expires_in_secs: Option<u64>,
}

async fn grant_capability(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GrantCapabilityRequest>,
) -> Json<serde_json::Value> {
    let mut manager = state.capability_manager.lock().await;
    
    match manager.grant(
        req.granted_to,
        "system".to_string(),
        req.capability,
        req.expires_in_secs,
    ) {
        Ok(token) => Json(serde_json::json!({ "token": token })),
        Err(e) => Json(serde_json::json!({ "error": e.to_string() })),
    }
}

async fn revoke_capability(
    State(state): State<Arc<AppState>>,
    path: axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    let token_id = path.0;
    let mut manager = state.capability_manager.lock().await;
    
    if manager.revoke(&token_id) {
        Json(serde_json::json!({ "revoked": true }))
    } else {
        Json(serde_json::json!({ "error": "Token not found" }))
    }
}

#[derive(serde::Deserialize)]
struct VerifyCapabilityRequest {
    token_id: String,
    required_capability: capability::Capability,
}

async fn verify_capability(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyCapabilityRequest>,
) -> Json<serde_json::Value> {
    let manager = state.capability_manager.lock().await;
    
    match manager.verify(&req.token_id, &req.required_capability) {
        capability::CapabilityResult::Valid { token } => {
            Json(serde_json::json!({
                "valid": true,
                "token": token,
            }))
        }
        capability::CapabilityResult::Invalid { reason } => {
            Json(serde_json::json!({
                "valid": false,
                "error": reason,
            }))
        }
        capability::CapabilityResult::Expired { expired_at } => {
            Json(serde_json::json!({
                "valid": false,
                "error": "Expired",
                "expired_at": expired_at,
            }))
        }
        capability::CapabilityResult::Revoked => {
            Json(serde_json::json!({
                "valid": false,
                "error": "Revoked",
            }))
        }
        capability::CapabilityResult::Denied { required, held } => {
            Json(serde_json::json!({
                "valid": false,
                "error": "Capability denied",
                "required": required,
                "held": held,
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_health_check() {
        let response = health_check().await;
        let body = response.0;
        assert_eq!(body["status"], "ok");
    }
}
