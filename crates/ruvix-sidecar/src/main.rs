mod ipc;
mod protocol;
mod ring_buffer;

use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::State,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, error};

use ipc::{IpcBridge, HealthStatus};

/// Application state shared across HTTP handlers
struct AppState {
    bridge: Arc<Mutex<IpcBridge>>,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    
    info!("RuVix Sidecar starting...");
    
    // Create IPC bridge
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
    
    let state = AppState { bridge };
    
    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/health/ruvix", get(ruvix_health))
        .route("/v1/events", post(record_event))
        .with_state(Arc::new(state));
    
    // Start server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:9001")
        .await
        .expect("Failed to bind to port 9001");
    
    info!("RuVix sidecar listening on http://127.0.0.1:9001");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed");
}

/// Basic health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "ruvix-sidecar",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Detailed RuVix kernel health check
async fn ruvix_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthStatus>, axum::http::StatusCode> {
    let bridge = state.bridge.lock().await;
    
    match bridge.health_check().await {
        Ok(status) => Ok(Json(status)),
        Err(_) => Err(axum::http::StatusCode::SERVICE_UNAVAILABLE),
    }
}

/// Record event endpoint (Phase 2)
async fn record_event(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    // TODO: Phase 2 - integrate with IpcBridge
    info!("Received event: {:?}", payload);
    
    Json(serde_json::json!({
        "status": "received",
        "event_id": payload.get("event_id").cloned().unwrap_or(serde_json::Value::Null),
    }))
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
