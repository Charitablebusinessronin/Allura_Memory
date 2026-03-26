// Phase 0: Read-only graph inspection
// Safe to run on any live graph

// Show all node labels in the database
MATCH (n)
RETURN DISTINCT labels(n) AS nodeLabels
ORDER BY nodeLabels;

// Show all relationship types
MATCH ()-[r]->()
RETURN DISTINCT type(r) AS relationshipTypes
ORDER BY relationshipTypes;

// Node count by label
MATCH (n)
UNWIND labels(n) AS label
RETURN label, count(*) AS count
ORDER BY count DESC;

// Relationship count by type
MATCH ()-[r]->()
RETURN type(r) AS relationshipType, count(*) AS count
ORDER BY count DESC;

// Sample nodes with properties (first 5 of each label)
MATCH (n)
WITH labels(n)[0] AS label, n
ORDER BY n.id
WITH label, collect(n)[0..5] AS samples
UNWIND samples AS node
RETURN label, node.id, node.groupId, keys(node) AS properties, node
ORDER BY label, node.id;

// Show property keys across all nodes
CALL db.schema.nodeTypeProperties() YIELD nodeType, propertyName, propertyTypes
RETURN nodeType, collect(propertyName) AS properties
ORDER BY nodeType;

// Show schema visualization
CALL db.schema.visualization();
