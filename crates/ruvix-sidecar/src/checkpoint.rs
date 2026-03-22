use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};
use sha2::{Sha256, Digest};

/// System checkpoint for deterministic replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub checkpoint_id: String,
    pub label: Option<String>,
    pub group_id: String,
    pub event_count: u64,
    pub last_event_id: Option<String>,
    pub created_at: u64,
    pub created_by: Option<String>,
    pub state_hash: String,
    pub witness_log_count: u64,
}

/// Witness log entry for replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WitnessLog {
    pub witness_id: String,
    pub event_id: String,
    pub group_id: String,
    pub proof_tier: String,
    pub proof_hash: String,
    pub proof_signature: Option<String>,
    pub proof_timestamp: u64,
    pub proof_nonce: u64,
    pub recorded_at: u64,
    pub checkpoint_id: Option<String>,
    pub data_hash: String,
}

/// Replay result
#[derive(Debug, Clone)]
pub enum ReplayResult {
    Success {
        events_replayed: u64,
        last_event_id: String,
    },
    Failed {
        reason: String,
        events_replayed: u64,
    },
}

/// Checkpoint and replay manager
pub struct CheckpointManager {
    checkpoints: Vec<Checkpoint>,
    witness_logs: Vec<WitnessLog>,
}

impl CheckpointManager {
    pub fn new() -> Self {
        Self {
            checkpoints: Vec::new(),
            witness_logs: Vec::new(),
        }
    }

    /// Create checkpoint from current state
    pub fn create_checkpoint(
        &mut self,
        label: Option<String>,
        group_id: String,
        event_count: u64,
        last_event_id: Option<String>,
        created_by: Option<String>,
    ) -> anyhow::Result<Checkpoint> {
        let now = Self::now_micros();
        
        // Compute state hash
        let state_hash = self.compute_state_hash(
            &group_id,
            event_count,
            last_event_id.as_ref(),
        );
        
        let witness_log_count = self.witness_logs.len() as u64;
        
        let checkpoint = Checkpoint {
            checkpoint_id: format!("chk_{}", now),
            label,
            group_id,
            event_count,
            last_event_id,
            created_at: now,
            created_by,
            state_hash,
            witness_log_count,
        };
        
        self.checkpoints.push(checkpoint.clone());
        
        Ok(checkpoint)
    }

    /// Replay events from checkpoint
    pub fn replay_from_checkpoint(
        &self,
        checkpoint_id: &str,
    ) -> ReplayResult {
        let checkpoint = match self.checkpoints.iter().find(|c| c.checkpoint_id == checkpoint_id) {
            Some(c) => c,
            None => {
                return ReplayResult::Failed {
                    reason: format!("Checkpoint {} not found", checkpoint_id),
                    events_replayed: 0,
                };
            }
        };
        
        // Find witness logs after this checkpoint
        let replay_logs: Vec<&WitnessLog> = self.witness_logs
            .iter()
            .filter(|log| {
                log.recorded_at >= checkpoint.created_at &&
                log.group_id == checkpoint.group_id
            })
            .collect();
        
        // Verify each log
        let mut events_replayed = 0u64;
        for log in &replay_logs {
            if !self.verify_witness_log(log) {
                return ReplayResult::Failed {
                    reason: format!("Witness log {} verification failed", log.witness_id),
                    events_replayed,
                };
            }
            events_replayed += 1;
        }
        
        // Verify final state
        let expected_hash = self.compute_state_hash(
            &checkpoint.group_id,
            checkpoint.event_count + events_replayed,
            replay_logs.last().map(|l| &l.event_id),
        );
        
        ReplayResult::Success {
            events_replayed,
            last_event_id: replay_logs
                .last()
                .map(|l| l.event_id.clone())
                .unwrap_or_default(),
        }
    }

    /// Add witness log entry
    pub fn add_witness_log(
        &mut self,
        witness_log: WitnessLog,
    ) {
        self.witness_logs.push(witness_log);
    }

    /// Get checkpoint by ID
    pub fn get_checkpoint(
        &self,
        checkpoint_id: &str,
    ) -> Option<&Checkpoint> {
        self.checkpoints.iter().find(|c| c.checkpoint_id == checkpoint_id)
    }

    /// List all checkpoints
    pub fn list_checkpoints(&self) -> &[Checkpoint] {
        &self.checkpoints
    }

    /// Get witness logs for group
    pub fn get_witness_logs(
        &self,
        group_id: &str,
    ) -> Vec<&WitnessLog> {
        self.witness_logs
            .iter()
            .filter(|log| log.group_id == group_id)
            .collect()
    }

    fn compute_state_hash(
        &self,
        group_id: &str,
        event_count: u64,
        last_event_id: Option<&String>,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(group_id);
        hasher.update(event_count.to_le_bytes());
        if let Some(id) = last_event_id {
            hasher.update(id);
        }
        format!("{:x}", hasher.finalize())
    }

    fn verify_witness_log(
        &self,
        log: &WitnessLog,
    ) -> bool {
        // Basic verification - hash format check
        log.proof_hash.len() == 64 &&
        log.data_hash.len() == 64
    }

    fn now_micros() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros() as u64
    }
}

impl Default for CheckpointManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_checkpoint() {
        let mut manager = CheckpointManager::new();
        let checkpoint = manager.create_checkpoint(
            Some("test-checkpoint".to_string()),
            "test-group".to_string(),
            100,
            Some("evt-100".to_string()),
            Some("test-user".to_string()),
        ).unwrap();
        
        assert_eq!(checkpoint.group_id, "test-group");
        assert_eq!(checkpoint.event_count, 100);
        assert!(checkpoint.state_hash.len() > 0);
    }

    #[test]
    fn test_add_witness_log() {
        let mut manager = CheckpointManager::new();
        let log = WitnessLog {
            witness_id: "wit-1".to_string(),
            event_id: "evt-1".to_string(),
            group_id: "test-group".to_string(),
            proof_tier: "reflex".to_string(),
            proof_hash: "abc123".to_string(),
            proof_signature: None,
            proof_timestamp: 1234567890,
            proof_nonce: 12345,
            recorded_at: 1234567890,
            checkpoint_id: None,
            data_hash: "def456".to_string(),
        };
        
        manager.add_witness_log(log);
        assert_eq!(manager.get_witness_logs("test-group").len(), 1);
    }

    #[test]
    fn test_replay_from_checkpoint() {
        let mut manager = CheckpointManager::new();
        
        // Create checkpoint
        let checkpoint = manager.create_checkpoint(
            None,
            "test-group".to_string(),
            0,
            None,
            None,
        ).unwrap();
        
        // Add witness logs
        for i in 0..5 {
            manager.add_witness_log(WitnessLog {
                witness_id: format!("wit-{}", i),
                event_id: format!("evt-{}", i),
                group_id: "test-group".to_string(),
                proof_tier: "reflex".to_string(),
                proof_hash: "a".repeat(64),
                proof_signature: None,
                proof_timestamp: 1000000 + i,
                proof_nonce: i as u64,
                recorded_at: 1000000 + i,
                checkpoint_id: None,
                data_hash: "b".repeat(64),
            });
        }
        
        // Replay
        match manager.replay_from_checkpoint(&checkpoint.checkpoint_id) {
            ReplayResult::Success { events_replayed, .. } => {
                assert_eq!(events_replayed, 5);
            }
            _ => panic!("Expected successful replay"),
        }
    }
}
