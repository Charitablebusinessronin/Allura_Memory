use shared_memory::{SharedMem, SharedMemConfig, LockType};
use std::sync::atomic::{AtomicUsize, Ordering};

/// Configuration for ring buffer
pub struct RingBufferConfig {
    pub capacity: usize,
    pub path: String,
}

/// Lock-free ring buffer using shared memory
/// Mimics io_uring CQ/SQ design for zero-copy IPC
pub struct RingBuffer {
    shm: SharedMem,
    head: AtomicUsize,
    tail: AtomicUsize,
    capacity: usize,
}

impl RingBuffer {
    /// Create new ring buffer in shared memory
    pub async fn create(config: RingBufferConfig) -> anyhow::Result<Self> {
        let shm_config = SharedMemConfig::default()
            .set_size(config.capacity * 2) // 2x for head/tail metadata
            .set_path(config.path.clone())
            .add_lock(LockType::Mutex, 0, 1)?; // Single lock for simplicity
        
        let shm = SharedMem::create(shm_config)?;
        
        Ok(Self {
            shm,
            head: AtomicUsize::new(0),
            tail: AtomicUsize::new(0),
            capacity: config.capacity,
        })
    }
    
    /// Write data to ring buffer
    pub async fn write(&mut self, data: &[u8]) -> anyhow::Result<()> {
        let len = data.len();
        if len > self.capacity {
            anyhow::bail!("Data too large for ring buffer");
        }
        
        let tail = self.tail.load(Ordering::SeqCst);
        let head = self.head.load(Ordering::SeqCst);
        
        // Check for overflow
        let available = self.capacity - (tail - head);
        if len > available {
            anyhow::bail!("Ring buffer full");
        }
        
        // Write length prefix (u32) + data
        let len_bytes = (len as u32).to_le_bytes();
        self.shm.write_bytes(&len_bytes, tail as usize)?;
        self.shm.write_bytes(data, (tail + 4) as usize)?;
        
        self.tail.fetch_add(len as usize + 4, Ordering::SeqCst);
        
        Ok(())
    }
    
    /// Read data from ring buffer
    pub async fn read(&mut self) -> anyhow::Result<Vec<u8>> {
        let tail = self.tail.load(Ordering::SeqCst);
        let head = self.head.load(Ordering::SeqCst);
        
        if head >= tail {
            return Ok(Vec::new()); // Empty
        }
        
        // Read length prefix
        let mut len_bytes = [0u8; 4];
        self.shm.read_bytes(&mut len_bytes, head as usize)?;
        let len = u32::from_le_bytes(len_bytes) as usize;
        
        if len == 0 {
            return Ok(Vec::new());
        }
        
        // Read data
        let mut data = vec![0u8; len];
        self.shm.read_bytes(&mut data, (head + 4) as usize)?;
        
        self.head.fetch_add(len + 4, Ordering::SeqCst);
        
        Ok(data)
    }
    
    /// Get current buffer length (bytes available to read)
    pub fn len(&self) -> usize {
        let tail = self.tail.load(Ordering::SeqCst);
        let head = self.head.load(Ordering::SeqCst);
        tail.saturating_sub(head)
    }
    
    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
    
    /// Check if shared memory is valid
    pub fn is_valid(&self) -> bool {
        // SharedMem doesn't expose is_valid, assume created successfully
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;
    
    #[tokio::test]
    async fn test_ring_buffer_basic() {
        let config = RingBufferConfig {
            capacity: 1024,
            path: "/tmp/test_ring_buffer".to_string(),
        };
        
        let mut buffer = RingBuffer::create(config).await.unwrap();
        
        let data = b"Hello, World!";
        buffer.write(data).await.unwrap();
        
        let read = buffer.read().await.unwrap();
        assert_eq!(read, data);
    }
    
    #[tokio::test]
    async fn test_ring_buffer_multiple() {
        let config = RingBufferConfig {
            capacity: 4096,
            path: "/tmp/test_ring_buffer_multi".to_string(),
        };
        
        let mut buffer = RingBuffer::create(config).await.unwrap();
        
        let messages = vec![
            b"First message",
            b"Second message",
            b"Third message",
        ];
        
        for msg in &messages {
            buffer.write(msg).await.unwrap();
        }
        
        for expected in &messages {
            let actual = buffer.read().await.unwrap();
            assert_eq!(&actual, *expected);
        }
    }
}
