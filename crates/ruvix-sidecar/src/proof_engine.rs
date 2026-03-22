use sha2::{Sha256, Digest};
use ed25519_dalek::{SigningKey, Signature, Signer, Verifier};
use rand::rngs::OsRng;
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Proof tier defines verification latency and security level
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProofTier {
    /// <10µs - High frequency events, hotpath mutations
    Reflex,
    /// ~100µs - Normal operations
    Standard,
    /// ~1ms - Security critical, agent activation
    Deep,
}

/// Cryptographic proof attesting to mutation validity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    pub tier: ProofTier,
    pub hash: String,
    pub signature: Option<String>,
    pub timestamp: u64,
    pub nonce: u64,
}

/// Proof verification result
#[derive(Debug, Clone)]
pub enum ProofResult {
    Valid { latency_micros: u64 },
    Invalid { reason: String },
    TierMismatch { expected: ProofTier, actual: ProofTier },
}

/// Proof engine for generating and verifying cryptographic proofs
pub struct ProofEngine {
    signing_key: Option<SigningKey>,
    verification_key: Option<[u8; 32]>,
}

impl ProofEngine {
    /// Create new proof engine
    pub fn new() -> Self {
        Self {
            signing_key: None,
            verification_key: None,
        }
    }

    /// Initialize with signing key for proof generation
    pub fn with_signing_key(mut self, key: &[u8; 32]) -> Self {
        self.signing_key = Some(SigningKey::from_bytes(key));
        self
    }

    /// Initialize with verification key for proof verification
    pub fn with_verification_key(mut self, key: [u8; 32]) -> Self {
        self.verification_key = Some(key);
        self
    }

    /// Generate proof for data mutation
    pub fn generate_proof(
        &self,
        data: &[u8],
        tier: ProofTier,
    ) -> anyhow::Result<Proof> {
        let start = Self::now_micros();
        
        // Compute hash based on tier
        let hash = match tier {
            ProofTier::Reflex => self.hash_reflex(data),
            ProofTier::Standard => self.hash_standard(data),
            ProofTier::Deep => self.hash_deep(data),
        };

        // Generate signature for Standard and Deep tiers
        let signature = if tier >= ProofTier::Standard {
            self.sign(&hash)?
        } else {
            None
        };

        let proof = Proof {
            tier,
            hash,
            signature,
            timestamp: Self::now_micros(),
            nonce: rand::random(),
        };

        // Verify latency requirement
        let elapsed = Self::now_micros() - start;
        Self::verify_latency(tier, elapsed)?;

        Ok(proof)
    }

    /// Verify proof against data
    pub fn verify_proof(
        &self,
        data: &[u8],
        proof: &Proof,
        expected_tier: ProofTier,
    ) -> ProofResult {
        let start = Self::now_micros();

        // Check tier match
        if proof.tier != expected_tier {
            return ProofResult::TierMismatch {
                expected: expected_tier,
                actual: proof.tier,
            };
        }

        // Recompute hash
        let computed_hash = match proof.tier {
            ProofTier::Reflex => self.hash_reflex(data),
            ProofTier::Standard => self.hash_standard(data),
            ProofTier::Deep => self.hash_deep(data),
        };

        // Verify hash
        if computed_hash != proof.hash {
            return ProofResult::Invalid {
                reason: "Hash mismatch".to_string(),
            };
        }

        // Verify signature for Standard and Deep
        if proof.tier >= ProofTier::Standard {
            if let Some(ref sig) = proof.signature {
                if !self.verify_signature(&proof.hash, sig) {
                    return ProofResult::Invalid {
                        reason: "Signature verification failed".to_string(),
                    };
                }
            } else {
                return ProofResult::Invalid {
                    reason: "Missing signature for tier".to_string(),
                };
            }
        }

        let elapsed = Self::now_micros() - start;
        ProofResult::Valid { latency_micros: elapsed }
    }

    // Reflex tier: Blake3 hash only, <10µs
    fn hash_reflex(&self, data: &[u8]) -> String {
        blake3::hash(data).to_hex().to_string()
    }

    // Standard tier: SHA-256 + signature, ~100µs
    fn hash_standard(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    // Deep tier: SHA-256 with context + signature, ~1ms
    fn hash_deep(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        // Add timestamp context for deep proofs
        hasher.update(Self::now_micros().to_le_bytes());
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    fn sign(&self,
        hash: &str,
    ) -> anyhow::Result<Option<String>> {
        if let Some(ref key) = self.signing_key {
            let signature = key.sign(hash.as_bytes());
            Ok(Some(base64::encode(signature.to_bytes())))
        } else {
            Ok(None)
        }
    }

    fn verify_signature(&self,
        hash: &str,
        signature_b64: &str,
    ) -> bool {
        if let Some(ref vk) = self.verification_key {
            // In production, use proper verification
            // For now, placeholder that always returns true
            // TODO: Implement Ed25519 verification
            let _ = (hash, signature_b64, vk);
            true
        } else {
            false
        }
    }

    fn verify_latency(
        tier: ProofTier,
        elapsed_micros: u64,
    ) -> anyhow::Result<()> {
        let max_latency = match tier {
            ProofTier::Reflex => 10u64,
            ProofTier::Standard => 100u64,
            ProofTier::Deep => 1000u64,
        };

        if elapsed_micros > max_latency {
            anyhow::bail!(
                "Proof generation exceeded latency budget: {}µs > {}µs",
                elapsed_micros, max_latency
            );
        }

        Ok(())
    }

    fn now_micros() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros() as u64
    }
}

impl Default for ProofEngine {
    fn default() -> Self {
        Self::new()
    }
}

// Base64 encoding helper
mod base64 {
    pub fn encode(input: &[u8]) -> String {
        use std::fmt::Write;
        let mut output = String::with_capacity(input.len() * 4 / 3 + 4);
        for chunk in input.chunks(3) {
            let b = match chunk.len() {
                1 => [chunk[0], 0, 0],
                2 => [chunk[0], chunk[1], 0],
                _ => [chunk[0], chunk[1], chunk[2]],
            };
            let idx = [
                b[0] >> 2,
                ((b[0] & 0x03) << 4) | (b[1] >> 4),
                ((b[1] & 0x0f) << 2) | (b[2] >> 6),
                b[2] & 0x3f,
            ];
            for i in 0..=chunk.len() {
                output.push(BASE64_TABLE[idx[i] as usize]);
            }
            for _ in chunk.len()..3 {
                output.push('=');
            }
        }
        output
    }

    const BASE64_TABLE: [char; 64] = [
        'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P',
        'Q','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f',
        'g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v',
        'w','x','y','z','0','1','2','3','4','5','6','7','8','9','+','/',
    ];
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_generation_reflex() {
        let engine = ProofEngine::new();
        let data = b"test event data";
        
        let proof = engine.generate_proof(data, ProofTier::Reflex).unwrap();
        
        assert_eq!(proof.tier, ProofTier::Reflex);
        assert!(proof.hash.len() > 0);
        assert!(proof.signature.is_none());
    }

    #[test]
    fn test_proof_generation_standard() {
        let engine = ProofEngine::new();
        let data = b"test event data";
        
        let proof = engine.generate_proof(data, ProofTier::Standard).unwrap();
        
        assert_eq!(proof.tier, ProofTier::Standard);
        assert!(proof.hash.len() > 0);
    }

    #[test]
    fn test_proof_verification_reflex() {
        let engine = ProofEngine::new();
        let data = b"test event data";
        
        let proof = engine.generate_proof(data, ProofTier::Reflex).unwrap();
        let result = engine.verify_proof(data, &proof, ProofTier::Reflex);
        
        match result {
            ProofResult::Valid { .. } => {},
            _ => panic!("Expected valid proof"),
        }
    }

    #[test]
    fn test_proof_tier_mismatch() {
        let engine = ProofEngine::new();
        let data = b"test event data";
        
        let proof = engine.generate_proof(data, ProofTier::Reflex).unwrap();
        let result = engine.verify_proof(data, &proof, ProofTier::Standard);
        
        match result {
            ProofResult::TierMismatch { .. } => {},
            _ => panic!("Expected tier mismatch"),
        }
    }

    #[test]
    fn test_proof_data_tampering() {
        let engine = ProofEngine::new();
        let data = b"original data";
        let tampered = b"tampered data";
        
        let proof = engine.generate_proof(data, ProofTier::Reflex).unwrap();
        let result = engine.verify_proof(tampered, &proof, ProofTier::Reflex);
        
        match result {
            ProofResult::Invalid { .. } => {},
            _ => panic!("Expected invalid proof for tampered data"),
        }
    }
}
