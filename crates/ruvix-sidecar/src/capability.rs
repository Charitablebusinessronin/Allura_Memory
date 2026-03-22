use sha2::{Sha256, Digest};
use rand::rngs::OsRng;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Capability types for Memory project operations
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Capability {
    // Event operations
    EventCreate { group_id: String },
    EventRead { group_id: String },
    
    // Insight operations
    InsightCreate { group_id: String },
    InsightPromote { group_id: String },
    InsightSupersede { group_id: String },
    
    // System operations
    SystemCheckpoint,
    SystemReplay,
    
    // Administrative
    PolicyModify,
}

/// Unforgeable capability token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityToken {
    pub token_id: String,
    pub capability: Capability,
    pub granted_to: String,
    pub granted_by: String,
    pub granted_at: u64,
    pub expires_at: Option<u64>,
    pub signature: String,
    pub revoked: bool,
}

/// Capability grant request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantRequest {
    pub capability: Capability,
    pub granted_to: String,
    pub expires_in_secs: Option<u64>,
}

/// Capability verification result
#[derive(Debug, Clone)]
pub enum CapabilityResult {
    Valid { token: CapabilityToken },
    Invalid { reason: String },
    Expired { expired_at: u64 },
    Revoked,
    Denied { required: Capability, held: Option<Capability> },
}

/// Capability manager for token lifecycle
pub struct CapabilityManager {
    tokens: HashMap<String, CapabilityToken>,
    signing_key: [u8; 32],
}

impl CapabilityManager {
    pub fn new() -> Self {
        Self {
            tokens: HashMap::new(),
            signing_key: OsRng.gen(),
        }
    }

    /// Grant capability to principal
    pub fn grant(
        &mut self,
        granted_to: String,
        granted_by: String,
        capability: Capability,
        expires_in_secs: Option<u64>,
    ) -> anyhow::Result<CapabilityToken> {
        let now = Self::now_micros();
        let expires_at = expires_in_secs.map(|secs| now + (secs * 1_000_000));
        
        let token = CapabilityToken {
            token_id: format!("cap_{}", now),
            capability: capability.clone(),
            granted_to: granted_to.clone(),
            granted_by,
            granted_at: now,
            expires_at,
            signature: self.sign_token(&granted_to, &capability),
            revoked: false,
        };
        
        self.tokens.insert(token.token_id.clone(), token.clone());
        
        Ok(token)
    }

    /// Revoke capability
    pub fn revoke(&mut self, token_id: &str) -> bool {
        if let Some(token) = self.tokens.get_mut(token_id) {
            token.revoked = true;
            true
        } else {
            false
        }
    }

    /// Verify capability token
    pub fn verify(
        &self,
        token_id: &str,
        required_capability: &Capability,
    ) -> CapabilityResult {
        let token = match self.tokens.get(token_id) {
            Some(t) => t,
            None => return CapabilityResult::Invalid {
                reason: "Token not found".to_string(),
            },
        };
        
        if token.revoked {
            return CapabilityResult::Revoked;
        }
        
        if let Some(expires_at) = token.expires_at {
            if Self::now_micros() > expires_at {
                return CapabilityResult::Expired { expired_at: expires_at };
            }
        }
        
        // Verify signature
        let expected_sig = self.sign_token(&token.granted_to, &token.capability);
        if token.signature != expected_sig {
            return CapabilityResult::Invalid {
                reason: "Signature mismatch".to_string(),
            };
        }
        
        // Check capability match
        if &token.capability != required_capability {
            return CapabilityResult::Denied {
                required: required_capability.clone(),
                held: Some(token.capability.clone()),
            };
        }
        
        CapabilityResult::Valid { token: token.clone() }
    }

    /// Check if principal has capability
    pub fn has_capability(
        &self,
        principal: &str,
        capability: &Capability,
    ) -> bool {
        self.tokens.values().any(|t| {
            !t.revoked &&
            t.granted_to == principal &&
            &t.capability == capability &&
            t.expires_at.map_or(true, |exp| Self::now_micros() <= exp)
        })
    }

    /// List capabilities for principal
    pub fn list_capabilities(
        &self,
        principal: &str,
    ) -> Vec<CapabilityToken> {
        self.tokens.values()
            .filter(|t| t.granted_to == principal && !t.revoked)
            .cloned()
            .collect()
    }

    /// Derive capability (create child from parent)
    pub fn derive(
        &mut self,
        parent_token_id: &str,
        new_granted_to: String,
        capability: Capability,
    ) -> anyhow::Result<CapabilityToken> {
        let parent = self.tokens.get(parent_token_id)
            .ok_or_else(|| anyhow::anyhow!("Parent token not found"))?;
        
        if parent.revoked {
            anyhow::bail!("Parent token revoked");
        }
        
        self.grant(
            new_granted_to,
            parent.granted_to.clone(),
            capability,
            parent.expires_at.map(|exp| (exp - Self::now_micros()) / 1_000_000),
        )
    }

    fn sign_token(
        &self,
        principal: &str,
        capability: &Capability,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(principal);
        hasher.update(serde_json::to_string(capability).unwrap_or_default());
        hasher.update(&self.signing_key);
        format!("{:x}", hasher.finalize())
    }

    fn now_micros() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros() as u64
    }
}

impl Default for CapabilityManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grant_capability() {
        let mut manager = CapabilityManager::new();
        
        let token = manager.grant(
            "agent-1".to_string(),
            "admin".to_string(),
            Capability::EventCreate { group_id: "test-group".to_string() },
            Some(3600),
        ).unwrap();
        
        assert_eq!(token.granted_to, "agent-1");
        assert!(!token.revoked);
        assert!(token.signature.len() > 0);
    }

    #[test]
    fn test_verify_capability() {
        let mut manager = CapabilityManager::new();
        
        let token = manager.grant(
            "agent-1".to_string(),
            "admin".to_string(),
            Capability::EventCreate { group_id: "test-group".to_string() },
            None,
        ).unwrap();
        
        let result = manager.verify(
            &token.token_id,
            &Capability::EventCreate { group_id: "test-group".to_string() },
        );
        
        match result {
            CapabilityResult::Valid { .. } => {},
            _ => panic!("Expected valid capability"),
        }
    }

    #[test]
    fn test_revoke_capability() {
        let mut manager = CapabilityManager::new();
        
        let token = manager.grant(
            "agent-1".to_string(),
            "admin".to_string(),
            Capability::EventCreate { group_id: "test-group".to_string() },
            None,
        ).unwrap();
        
        manager.revoke(&token.token_id);
        
        let result = manager.verify(
            &token.token_id,
            &Capability::EventCreate { group_id: "test-group".to_string() },
        );
        
        match result {
            CapabilityResult::Revoked => {},
            _ => panic!("Expected revoked capability"),
        }
    }

    #[test]
    fn test_derive_capability() {
        let mut manager = CapabilityManager::new();
        
        let parent = manager.grant(
            "agent-1".to_string(),
            "admin".to_string(),
            Capability::EventCreate { group_id: "test-group".to_string() },
            Some(3600),
        ).unwrap();
        
        let child = manager.derive(
            &parent.token_id,
            "agent-2".to_string(),
            Capability::EventRead { group_id: "test-group".to_string() },
        ).unwrap();
        
        assert_eq!(child.granted_to, "agent-2");
        assert_eq!(child.granted_by, "agent-1");
    }

    #[test]
    fn test_has_capability() {
        let mut manager = CapabilityManager::new();
        
        manager.grant(
            "agent-1".to_string(),
            "admin".to_string(),
            Capability::EventCreate { group_id: "test-group".to_string() },
            None,
        ).unwrap();
        
        assert!(manager.has_capability(
            "agent-1",
            &Capability::EventCreate { group_id: "test-group".to_string() },
        ));
        
        assert!(!manager.has_capability(
            "agent-2",
            &Capability::EventCreate { group_id: "test-group".to_string() },
        ));
    }
}
