# postgres

> API documentation for `postgres` module.

## Functions

### `getConnectionConfig`

Get connection configuration from environment variables Uses safe defaults matching docker-compose.yml setup

---

### `getPool`

Get or create the singleton PostgreSQL connection pool Uses server-only pattern - should only be called from server-side code

---

### `closePool`

Close the connection pool Call this during graceful shutdown

---

### `isPoolHealthy`

Check if the pool is currently connected Useful for health checks

---

## Interfaces

### `ConnectionConfig`

PostgreSQL connection configuration Built from environment variables with safe defaults

---

### `PoolConfig`

Pool configuration for connection safety

---
