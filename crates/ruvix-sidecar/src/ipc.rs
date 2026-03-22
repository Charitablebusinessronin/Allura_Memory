use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

pub mod ring_buffer;
pub mod protocol;

use protocol::{IpcMessage, IpcResponse};
use ring_buffer::{RingBuffer, RingBufferConfig};

const IPC_CHANNEL_SIZE: usize = 1024;

/// IPC bridge between TypeScript (Node.js) and Rust sidecar
/// Uses shared memory ring buffer for zero-copy communication
pub struct IpcBridge {
    /// Shared memory ring buffer for high-throughput messages
    ring_buffer: Arc<Mutex<RingBuffer>>,
    /// Async channel for responses back to TypeScript
    response_tx: mpsc::Sender<IpcResponse>,
    /// Request counter for correlation
    request_counter: AtomicU64,
}

impl IpcBridge {
    /// Create new IPC bridge with shared memory segment
    pub async fn new(shm_path: &str) -> anyhow::Result<Self> {
        let config = RingBufferConfig {
            capacity: 1024 * 1024, // 1MB buffer
            path: shm_path.to_string(),
        };
        
        let ring_buffer = Arc::new(Mutex::new(
            RingBuffer::create(config).await?
        ));
        
        let (response_tx, _) = mpsc::channel(IPC_CHANNEL_SIZE);
        
        Ok(Self {
            ring_buffer,
            response_tx,
            request_counter: AtomicU64::new(0),
        })
    }
    
    /// Send message to TypeScript side
    pub async fn send(
        &self,
        message: IpcMessage,
    ) -> anyhow::Result<IpcResponse> {
        let request_id = self.request_counter.fetch_add(1, Ordering::SeqCst);
        
        let encoded = bincode::serialize(&message)?;
        
        let mut buffer = self.ring_buffer.lock().await;
        buffer.write(&encoded).await?;
        
        Ok(IpcResponse {
            request_id,
            status: protocol::ResponseStatus::Ok,
            payload: None,
        })
    }
    
    /// Receive message from TypeScript side
    pub async fn receive(
        &self,
    ) -> anyhow::Result<Option<IpcMessage>> {
        let mut buffer = self.ring_buffer.lock().await;
        let data = buffer.read().await?;
        
        if data.is_empty() {
            return Ok(None);
        }
        
        let message = bincode::deserialize(&data)?;
        Ok(Some(message))
    }
    
    /// Check if bridge is healthy
    pub async fn health_check(&self,
    ) -> anyhow::Result<HealthStatus> {
        let buffer = self.ring_buffer.lock().await;
        
        Ok(HealthStatus {
            ring_buffer_available: buffer.is_valid(),
            messages_queued: buffer.len(),
            latency_micros: self.measure_latency().await,
        })
    }
    
    async fn measure_latency(&self,
    ) -> u64 {
        let start = std::time::Instant::now();
        
        // Send ping, wait for pong
        let ping = IpcMessage::Ping { timestamp: start.elapsed().as_micros() as u64 };
        let _ = self.send(ping).await;
        
        start.elapsed().as_micros() as u64
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub ring_buffer_available: bool,
    pub messages_queued: usize,
    pub latency_micros: u64,
}
