# circuit-breaker

> API documentation for `circuit-breaker` module.

## Functions

### `generateAlertId`

Generate unique alert ID

---

### `determineSeverity`

Determine severity based on event type and context

---

### `generateAlertMessage`

Generate human-readable alert message

---

### `createTripAlert`

Create a Mission Control alert from a trip event

---

### `createResetAlert`

Create a Mission Control alert from a reset event

---

### `createStateChangeAlert`

Create a Mission Control alert from a state change event

---

### `logBreakerEventToPostgres`

Log circuit breaker event to PostgreSQL for audit trail

---

### `createTripAlertCallback`

Create trip callback for Mission Control integration

---

### `createResetAlertCallback`

Create reset callback for Mission Control integration

---

### `createStateChangeAlertCallback`

Create state change callback for Mission Control integration

---

### `getPendingAlerts`

Get pending alerts from queue

---

### `getAllAlerts`

Get all alerts from queue

---

### `getAlert`

Get specific alert by ID

---

### `acknowledgeAlert`

Acknowledge an alert

---

### `onAlert`

Register callback for new alerts

---

### `offAlert`

Remove callback

---

### `getBreakerManager`

Get default breaker manager instance

---

### `createBreakerManager`

Create a new breaker manager with custom config

---

### `resetBreakerManager`

Reset default breaker manager (for testing)

---

## Classes

### `AlertQueue`

In-memory alert queue for Mission Control In production, this would integrate with a real-time notification system

---

### `CircuitBreaker`

Circuit Breaker - Prevents cascade failures by tripping on error thresholds  State Machine: ┌───────┐  threshold_exceeded   ┌─────┐  timeout_expired   ┌───────────┐ │CLOSED │ ───────────────────▶ │OPEN │ ────────────────▶ │ HALF_OPEN │ └───────┘                        └─────┘                   └───────────┘     ▲                                                       │     │                        health_check_passed            │     └───────────────────────────────────────────────────────┘     │                                                       │     │                                       health_check_failed     └───────────────────────────────────────────────────────┘  CLOSED: Normal operation - all requests flow through OPEN: Tripped - all requests are rejected immediately HALF_OPEN: Testing - limited requests allowed to check health

---

### `BreakerManager`

Circuit Breaker Manager Central management for all circuit breakers with reset mechanisms

---

## Interfaces

### `MissionControlAlert`

Mission Control alert payload

---

### `BreakerManagerConfig`

Manager configuration

---

### `ResetRequest`

Reset request payload

---

### `ResetResult`

Reset result

---

### `BreakerError`

Error record for tracking

---

### `BreakerSuccess`

Success record for tracking

---

### `BreakerConfig`

Circuit breaker configuration

---

### `BreakerStateSnapshot`

Circuit breaker state snapshot

---

### `BreakerResult`

Execution result wrapper

---

### `BreakerTripEvent`

Trip event data for alerting

---

### `BreakerResetEvent`

Reset event data for alerting

---

### `BreakerStateChangeEvent`

State change event

---

### `BreakerRegistryEntry`

Breaker registry entry

---

## Type Definitions

### `EventInsert`

Circuit Breaker Alerting - Mission Control Integration Story 3.6: Implement Circuit Breakers for Operational Safety  Handles alerting and logging for circuit breaker events: - Trip alerts to Mission Control - Reset notifications - PostgreSQL logging for audit trail

---

### `AlertSeverity`

Alert severity levels for Mission Control

---

### `AlertCallback`

Alert callback type

---

### `BreakerManagerConfig`

Circuit Breaker Module - Public API Story 3.6: Implement Circuit Breakers for Operational Safety

---

### `BreakerState`

Circuit breaker states (finite state machine)  CLOSED: Normal operation - requests flow through OPEN: Tripped state - requests are rejected with fallback HALF_OPEN: Testing state - limited requests allowed to test recovery

---

### `TransitionReason`

Reason for state transition

---

### `ErrorSeverity`

Error severity levels

---

### `BreakerTripCallback`

Callback types

---

### `HealthCheckFunction`

Health check function type

---

### `BreakerScope`

Breaker scope for different breaker types

---
