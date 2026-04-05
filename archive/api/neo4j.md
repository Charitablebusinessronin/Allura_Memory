# neo4j

> API documentation for `neo4j` module.

## Functions

### `getConnectionConfig`

Get connection configuration from environment variables Uses safe defaults matching docker-compose.yml setup

---

### `getDriver`

Get or create the singleton Neo4j driver instance Uses server-only pattern - should only be called from server-side code

---

### `getSession`

Get a session from the driver

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `database` | `unknown` | - Optional database name (defaults to 'neo4j') |

**Returns:**

`void` - A Neo4j session

---

### `closeDriver`

Close the driver connection Call this during graceful shutdown

---

### `isDriverHealthy`

Check if the driver is currently connected Useful for health checks

---

### `verifyConnectivity`

Verify connectivity to the Neo4j database Throws if connection fails

---

### `readTransaction`

Execute a read transaction with automatic retry on transient errors

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `work` | `unknown` | - The transaction function to execute |
| `database` | `unknown` | - Optional database name |

**Returns:**

`void` - The result of the work function

---

### `writeTransaction`

Execute a write transaction with automatic retry on transient errors

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `work` | `unknown` | - The transaction function to execute |
| `database` | `unknown` | - Optional database name |

**Returns:**

`void` - The result of the work function

---

## Interfaces

### `Neo4jConnectionConfig`

Neo4j connection configuration Built from environment variables with safe defaults

---

### `PoolConfig`

Pool configuration for connection safety

---
