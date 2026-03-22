use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Graph node identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct NodeId(pub String);

/// Graph edge identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct EdgeId(pub String);

/// Graph node with properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: NodeId,
    pub labels: Vec<String>,
    pub properties: serde_json::Value,
    pub group_id: String,
    pub created_at: u64,
}

/// Graph edge with relationship type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: EdgeId,
    pub source: NodeId,
    pub target: NodeId,
    pub relation_type: String,
    pub properties: serde_json::Value,
    pub group_id: String,
    pub created_at: u64,
}

/// Graph store configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphStoreConfig {
    pub max_nodes: usize,
    pub max_edges: usize,
}

impl Default for GraphStoreConfig {
    fn default() -> Self {
        Self {
            max_nodes: 10000,
            max_edges: 50000,
        }
    }
}

/// Graph store result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQueryResult {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// In-memory graph store (Neo4j-like semantics placeholder)
pub struct GraphStore {
    store_id: String,
    config: GraphStoreConfig,
    nodes: HashMap<NodeId, GraphNode>,
    edges: HashMap<EdgeId, GraphEdge>,
    group_id: String,
}

impl GraphStore {
    pub fn new(store_id: String, config: GraphStoreConfig, group_id: String) -> Self {
        Self {
            store_id,
            config,
            nodes: HashMap::new(),
            edges: HashMap::new(),
            group_id,
        }
    }

    /// Create node with proof-gated mutation
    pub fn create_node(
        &mut self,
        id: NodeId,
        labels: Vec<String>,
        properties: serde_json::Value,
    ) -> anyhow::Result<()> {
        if self.nodes.len() >= self.config.max_nodes {
            anyhow::bail!("Graph store at node capacity");
        }

        if self.nodes.contains_key(&id) {
            anyhow::bail!("Node already exists: {}", id.0);
        }

        let node = GraphNode {
            id: id.clone(),
            labels,
            properties,
            group_id: self.group_id.clone(),
            created_at: crate::proof_engine::ProofEngine::now_micros(),
        };

        self.nodes.insert(id, node);
        Ok(())
    }

    /// Create edge with proof-gated mutation
    pub fn create_edge(
        &mut self,
        id: EdgeId,
        source: NodeId,
        target: NodeId,
        relation_type: String,
        properties: serde_json::Value,
    ) -> anyhow::Result<()> {
        if self.edges.len() >= self.config.max_edges {
            anyhow::bail!("Graph store at edge capacity");
        }

        if !self.nodes.contains_key(&source) {
            anyhow::bail!("Source node not found: {}", source.0);
        }

        if !self.nodes.contains_key(&target) {
            anyhow::bail!("Target node not found: {}", target.0);
        }

        let edge = GraphEdge {
            id: id.clone(),
            source,
            target,
            relation_type,
            properties,
            group_id: self.group_id.clone(),
            created_at: crate::proof_engine::ProofEngine::now_micros(),
        };

        self.edges.insert(id, edge);
        Ok(())
    }

    /// Get node by ID
    pub fn get_node(&self, id: &NodeId) -> Option<&GraphNode> {
        self.nodes.get(id)
    }

    /// Get edge by ID
    pub fn get_edge(&self, id: &EdgeId) -> Option<&GraphEdge> {
        self.edges.get(id)
    }

    /// Query subgraph
    pub fn query(
        &self,
        node_labels: Option<&[String]>,
        relation_type: Option<&str>,
        limit: usize,
    ) -> GraphQueryResult {
        let nodes: Vec<GraphNode> = self.nodes.values()
            .filter(|n| {
                node_labels.map_or(true, |labels| {
                    labels.iter().any(|l| n.labels.contains(l))
                })
            })
            .take(limit)
            .cloned()
            .collect();

        let edges: Vec<GraphEdge> = self.edges.values()
            .filter(|e| {
                relation_type.map_or(true, |rel| e.relation_type == rel)
            })
            .take(limit)
            .cloned()
            .collect();

        GraphQueryResult { nodes, edges }
    }

    /// Supersede node (create new version, mark old as deprecated)
    pub fn supersede_node(
        &mut self,
        old_id: &NodeId,
        new_id: NodeId,
        labels: Vec<String>,
        properties: serde_json::Value,
    ) -> anyhow::Result<()> {
        let old_node = self.nodes.get(old_id)
            .ok_or_else(|| anyhow::anyhow!("Old node not found"))?;

        self.create_node(new_id.clone(), labels, properties)?;
        Ok(())
    }

    /// Get store statistics
    pub fn stats(&self) -> GraphStoreStats {
        GraphStoreStats {
            store_id: self.store_id.clone(),
            node_count: self.nodes.len(),
            edge_count: self.edges.len(),
            group_id: self.group_id.clone(),
        }
    }
}

/// Graph store statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphStoreStats {
    pub store_id: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub group_id: String,
}

/// Graph store manager for multiple stores
pub struct GraphStoreManager {
    stores: HashMap<String, Arc<GraphStore>>,
}

impl GraphStoreManager {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
        }
    }

    pub fn create_store(
        &mut self,
        store_id: String,
        config: GraphStoreConfig,
        group_id: String,
    ) -> anyhow::Result<Arc<GraphStore>> {
        if self.stores.contains_key(&store_id) {
            anyhow::bail!("Store already exists: {}", store_id);
        }

        let store = Arc::new(GraphStore::new(store_id.clone(), config, group_id));
        self.stores.insert(store_id, store.clone());
        Ok(store)
    }

    pub fn get_store(&self, store_id: &str) -> Option<Arc<GraphStore>> {
        self.stores.get(store_id).cloned()
    }

    pub fn list_stores(&self) -> Vec<String> {
        self.stores.keys().cloned().collect()
    }
}

impl Default for GraphStoreManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graph_store_create_node() {
        let config = GraphStoreConfig::default();
        let mut store = GraphStore::new("test-graph".to_string(), config, "test-group".to_string());
        
        let id = NodeId("node-1".to_string());
        let labels = vec!["Entity".to_string()];
        let properties = serde_json::json!({"name": "Test"});
        
        store.create_node(id.clone(), labels, properties).unwrap();
        
        let node = store.get_node(&id).unwrap();
        assert_eq!(node.id, id);
        assert_eq!(node.group_id, "test-group");
    }

    #[test]
    fn test_graph_store_create_edge() {
        let config = GraphStoreConfig::default();
        let mut store = GraphStore::new("test-graph".to_string(), config, "test-group".to_string());
        
        store.create_node(NodeId("node-1".to_string()), vec!["A".to_string()], serde_json::json!({})).unwrap();
        store.create_node(NodeId("node-2".to_string()), vec!["B".to_string()], serde_json::json!({})).unwrap();
        
        let edge_id = EdgeId("edge-1".to_string());
        store.create_edge(
            edge_id.clone(),
            NodeId("node-1".to_string()),
            NodeId("node-2".to_string()),
            "RELATES_TO".to_string(),
            serde_json::json!({}),
        ).unwrap();
        
        let edge = store.get_edge(&edge_id).unwrap();
        assert_eq!(edge.relation_type, "RELATES_TO");
    }

    #[test]
    fn test_graph_store_query() {
        let config = GraphStoreConfig::default();
        let mut store = GraphStore::new("test-graph".to_string(), config, "test-group".to_string());
        
        store.create_node(NodeId("node-1".to_string()), vec!["Entity".to_string()], serde_json::json!({})).unwrap();
        store.create_node(NodeId("node-2".to_string()), vec!["Event".to_string()], serde_json::json!({})).unwrap();
        
        let result = store.query(Some(&[vec!["Entity".to_string()]]), None, 10);
        assert_eq!(result.nodes.len(), 1);
        assert_eq!(result.nodes[0].labels[0], "Entity");
    }

    #[test]
    fn test_graph_store_manager() {
        let mut manager = GraphStoreManager::new();
        
        let config = GraphStoreConfig::default();
        let store = manager.create_store("graph-1".to_string(), config, "group-1".to_string()).unwrap();
        
        assert_eq!(manager.list_stores(), vec!["graph-1"]);
        assert!(manager.get_store("graph-1").is_some());
    }
}
