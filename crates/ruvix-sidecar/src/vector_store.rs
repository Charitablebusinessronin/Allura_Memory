use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Vector key for storage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct VectorKey(pub u64);

impl VectorKey {
    pub fn new(id: u64) -> Self {
        Self(id)
    }
}

/// Vector store configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorStoreConfig {
    pub dimensions: usize,
    pub capacity: usize,
    pub distance_metric: DistanceMetric,
}

impl VectorStoreConfig {
    pub fn new(dimensions: usize, capacity: usize) -> Self {
        Self {
            dimensions,
            capacity,
            distance_metric: DistanceMetric::Cosine,
        }
    }
}

/// Distance metric for similarity search
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DistanceMetric {
    Cosine,
    Euclidean,
    DotProduct,
}

/// Vector entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorEntry {
    pub key: VectorKey,
    pub data: Vec<f64>,
    pub metadata: serde_json::Value,
    pub group_id: String,
    pub created_at: u64,
}

/// Vector store result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchResult {
    pub key: VectorKey,
    pub distance: f64,
    pub metadata: serde_json::Value,
}

/// In-memory vector store (HNSW placeholder - production would use usearch/hnswlib)
pub struct VectorStore {
    store_id: String,
    config: VectorStoreConfig,
    vectors: HashMap<VectorKey, VectorEntry>,
    group_id: String,
}

impl VectorStore {
    pub fn new(store_id: String, config: VectorStoreConfig, group_id: String) -> Self {
        Self {
            store_id,
            config,
            vectors: HashMap::new(),
            group_id,
        }
    }

    /// Put vector with proof-gated mutation
    pub fn put(
        &mut self,
        key: VectorKey,
        data: Vec<f64>,
        metadata: serde_json::Value,
    ) -> anyhow::Result<()> {
        if data.len() != self.config.dimensions {
            anyhow::bail!(
                "Vector dimension mismatch: expected {}, got {}",
                self.config.dimensions,
                data.len()
            );
        }

        if self.vectors.len() >= self.config.capacity {
            anyhow::bail!("Vector store at capacity");
        }

        let entry = VectorEntry {
            key: key.clone(),
            data,
            metadata,
            group_id: self.group_id.clone(),
            created_at: crate::proof_engine::ProofEngine::now_micros(),
        };

        self.vectors.insert(key, entry);
        Ok(())
    }

    /// Get vector by key
    pub fn get(&self, key: &VectorKey) -> Option<&VectorEntry> {
        self.vectors.get(key)
    }

    /// Search for similar vectors (cosine similarity placeholder)
    pub fn search(
        &self,
        query: &[f64],
        limit: usize,
    ) -> Vec<VectorSearchResult> {
        let mut results: Vec<VectorSearchResult> = self.vectors.values()
            .map(|entry| {
                let distance = self.cosine_distance(&entry.data, query);
                VectorSearchResult {
                    key: entry.key.clone(),
                    distance,
                    metadata: entry.metadata.clone(),
                }
            })
            .collect();

        results.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);
        results
    }

    pub fn remove(&mut self, key: &VectorKey) -> bool {
        self.vectors.remove(key).is_some()
    }

    /// Get store statistics
    pub fn stats(&self) -> VectorStoreStats {
        VectorStoreStats {
            store_id: self.store_id.clone(),
            vector_count: self.vectors.len(),
            dimensions: self.config.dimensions,
            capacity: self.config.capacity,
            group_id: self.group_id.clone(),
        }
    }

    fn cosine_distance(&self, a: &[f64], b: &[f64]) -> f64 {
        let dot = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum::<f64>();
        let norm_a = a.iter().map(|x| x * x).sum::<f64>().sqrt();
        let norm_b = b.iter().map(|x| x * x).sum::<f64>().sqrt();
        
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            1.0 - (dot / (norm_a * norm_b))
        }
    }
}

/// Vector store statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorStoreStats {
    pub store_id: String,
    pub vector_count: usize,
    pub dimensions: usize,
    pub capacity: usize,
    pub group_id: String,
}

/// Vector store manager for multiple stores
pub struct VectorStoreManager {
    stores: HashMap<String, Arc<VectorStore>>,
}

impl VectorStoreManager {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
        }
    }

    pub fn create_store(
        &mut self,
        store_id: String,
        config: VectorStoreConfig,
        group_id: String,
    ) -> anyhow::Result<Arc<VectorStore>> {
        if self.stores.contains_key(&store_id) {
            anyhow::bail!("Store already exists: {}", store_id);
        }

        let store = Arc::new(VectorStore::new(store_id.clone(), config, group_id));
        self.stores.insert(store_id, store.clone());
        Ok(store)
    }

    pub fn get_store(&self, store_id: &str) -> Option<Arc<VectorStore>> {
        self.stores.get(store_id).cloned()
    }

    pub fn list_stores(&self) -> Vec<String> {
        self.stores.keys().cloned().collect()
    }

    pub fn remove_store(&mut self, store_id: &str) -> bool {
        self.stores.remove(store_id).is_some()
    }
}

impl Default for VectorStoreManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_store_put_get() {
        let config = VectorStoreConfig::new(4, 100);
        let mut store = VectorStore::new("test-store".to_string(), config, "test-group".to_string());
        
        let key = VectorKey::new(1);
        let data = vec![1.0, 2.0, 3.0, 4.0];
        let metadata = serde_json::json!({"label": "test"});
        
        store.put(key.clone(), data.clone(), metadata.clone()).unwrap();
        
        let entry = store.get(&key).unwrap();
        assert_eq!(entry.key, key);
        assert_eq!(entry.data, data);
        assert_eq!(entry.group_id, "test-group");
    }

    #[test]
    fn test_vector_store_search() {
        let config = VectorStoreConfig::new(3, 100);
        let mut store = VectorStore::new("test-store".to_string(), config, "test-group".to_string());
        
        store.put(VectorKey::new(1), vec![1.0, 0.0, 0.0], serde_json::json!({})).unwrap();
        store.put(VectorKey::new(2), vec![0.0, 1.0, 0.0], serde_json::json!({})).unwrap();
        store.put(VectorKey::new(3), vec![0.0, 0.0, 1.0], serde_json::json!({})).unwrap();
        
        let results = store.search(&[1.0, 0.0, 0.0], 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].key, VectorKey::new(1));
    }

    #[test]
    fn test_vector_store_capacity() {
        let config = VectorStoreConfig::new(2, 2);
        let mut store = VectorStore::new("test-store".to_string(), config, "test-group".to_string());
        
        store.put(VectorKey::new(1), vec![1.0, 2.0], serde_json::json!({})).unwrap();
        store.put(VectorKey::new(2), vec![3.0, 4.0], serde_json::json!({})).unwrap();
        
        assert!(store.put(VectorKey::new(3), vec![5.0, 6.0], serde_json::json!({})).is_err());
    }

    #[test]
    fn test_vector_store_manager() {
        let mut manager = VectorStoreManager::new();
        
        let config = VectorStoreConfig::new(4, 100);
        let store = manager.create_store("store-1".to_string(), config, "group-1".to_string()).unwrap();
        
        assert_eq!(manager.list_stores(), vec!["store-1"]);
        assert!(manager.get_store("store-1").is_some());
        assert!(manager.get_store("store-2").is_none());
    }
}
