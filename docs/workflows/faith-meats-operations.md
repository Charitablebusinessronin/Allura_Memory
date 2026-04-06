# Faith Meats Operations Workflow

> **Story:** 6-2 - Faith Meats Operations
> **Status:** In Progress
> **Created:** 2026-04-06
> **Version:** 1.0.0

## Overview

The Faith Meats Operations workflow orchestrates all operational aspects of the Faith Meats meat snack business, including:

1. **Order Processing** - Customer order lifecycle from creation to delivery
2. **HACCP Compliance** - Critical Control Point monitoring and violation tracking
3. **Inventory Management** - Stock updates, threshold alerts, discrepancy detection
4. **Business Intelligence** - Reporting and analytics for operations dashboard

## Architecture

### High-Level Flow

```
Customer Order
      ↓
FaithMeatsOperations.processOrder()
      ↓
[Validate Inventory]
      ↓
[Create Order Record] (PostgreSQL)
      ↓
[Decrement Inventory] (InventoryManager)
      ↓
[Log Order Event] (PostgreSQL events)
      ↓
[Create Neo4j Relationships] (Customer → Order → Product)
```

### Order State Machine

```
created → processing → shipped → delivered
               ↓
            cancelled (restores inventory)
```

**Valid Transitions:**
- `created` → `processing`
- `processing` → `shipped`
- `shipped` → `delivered`
- `created` or `processing` → `cancelled`

### HACCP CCP Flow

Each Critical Control Point follows a validation pipeline:

```
1. Record Reading
     ↓
2. Validate Against Threshold
     ↓
3. If Within Limits → Log to PostgreSQL (completed)
   If Outside Limits → Create Violation (pending) → Flag for Review → Escalate to Quality Manager
     ↓
4. Log HACCP Event (append-only)
     ↓
5. Maintain 7-year audit trail
```

### Inventory Snapshot Pattern

```
Daily Snapshot
     ↓
Compare to Previous Snapshot
     ↓
Detect Discrepancy (>5% deviation)
     ↓
Create Alert → Notify Operations Team
```

## Components

### 1. FaithMeatsOperations (Workflow Orchestrator)

**Location:** `src/workflows/faith-meats.ts`

**Responsibilities:**
- Order lifecycle management
- Integration between HACCP, Inventory, and BI modules
- Transaction boundaries for data consistency
- Event logging for audit trail

**Key Methods:**

#### `processOrder(orderData)`

Creates new customer orders with inventory validation.

```typescript
const result = await ops.processOrder({
  customerId: 'customer-123',
  products: [
    { productId: 'product-001', productName: 'Beef Jerky', quantity: 2, unitPrice: 12.99 }
  ],
  notes: 'Express delivery requested'
});
```

**Process:**
1. Validate order data
2. Check inventory availability for all products
3. Create order record (append-only in PostgreSQL)
4. Decrement inventory atomically
5. Log order event

**Error Cases:**
- Insufficient inventory → throws Error with product ID and quantities
- Invalid customer → throws validation Error

#### `cancelOrder(orderId, reason)`

Cancels orders and restores inventory.

```typescript
await ops.cancelOrder('order-123', 'Customer request');
```

**Process:**
1. Validate order exists and is cancellable
2. Update status to `cancelled`
3. Restore inventory for all products
4. Log cancellation event

**Error Cases:**
- Order already shipped/delivered → throws Error, escalate to human
- Order not found → throws Error

#### `checkCCPCompliance(productionRun)`

Validates HACCP compliance for production runs.

```typescript
const result = await ops.checkCCPCompliance({
  productionRunId: 'batch-2026-04-06-001',
  readings: [
    { ccpId: 'CCP-1', value: 2, unit: 'celsius', operatorId: 'operator-001', timestamp: new Date() }
  ]
});
```

**Process:**
1. Record each CCP reading
2. Validate against thresholds
3. Create violations for out-of-limits readings
4. Return compliance status

**Returns:**
```typescript
{
  compliant: boolean,
  violations: Array<{ ccpId: string, deviation: string }>
}
```

#### `generateBIReport(type, params)`

Generates business intelligence reports.

```typescript
// Monthly order volume
const monthlyReport = await ops.generateBIReport('monthly_order_volume', {
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31')
});

// Inventory status
const inventoryReport = await ops.generateBIReport('inventory_status');

// HACCP compliance
const haccpReport = await ops.generateBIReport('haccp_compliance');

// Product sales
const salesReport = await ops.generateBIReport('product_sales', {
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31')
});

// Customer orders
const customerReport = await ops.generateBIReport('customer_orders', {
  customerId: 'customer-123'
});
```

**Report Types:**
- `monthly_order_volume` - Orders grouped by status
- `inventory_status` - Product availability and low stock alerts
- `haccp_compliance` - Pending violations summary
- `product_sales` - Top products by revenue
- `customer_orders` - Order history for a customer

### 2. HACCPCompliance (HACCP Module)

**Location:** `src/lib/haccp/compliance.ts`

**Responsibilities:**
- CCP threshold validation
- Violation tracking and escalation
- 7-year audit trail maintenance

**CCP Definitions:**

| CCP ID | Description | Threshold | Monitoring |
|--------|-------------|-----------|------------|
| CCP-1 | Raw material receiving | -18°C to 4°C | Every delivery |
| CCP-2 | Storage temperature | -18°C to -12°C | Continuous |
| CCP-3 | Processing temperature | ≥63°C | Every batch |
| CCP-4 | Metal detection | 0 ferrous contaminants | Every package |
| CCP-5 | Final product storage | -18°C to -12°C | Continuous |

**Key Methods:**

#### `recordReading(params)`

Records CCP reading and validates against threshold.

```typescript
const result = await haccp.recordReading({
  ccpId: 'CCP-1',
  value: 2,
  unit: 'celsius',
  loggedBy: 'operator-001',
  documentationRef: 'delivery-2026-04-06-001'
});
```

**Returns:**
```typescript
{
  readingId: number,
  withinLimits: boolean,
  violationId?: number  // Created if outside limits
}
```

#### `getUnreviewedViolations()`

Returns pending violations for quality manager review.

```typescript
const violations = await haccp.getUnreviewedViolations();
```

#### `resolveViolation(violationId, resolution, resolvedBy)`

Marks violation as resolved.

```typescript
await haccp.resolveViolation(
  violationId,
  'Temperature corrected, delivery accepted after inspection',
  'quality-manager-001'
);
```

### 3. InventoryManager (Inventory Module)

**Location:** `src/lib/inventory/manager.ts`

**Responsibilities:**
- Stock level management
- Threshold alerts
- Snapshot-based discrepancy detection

**Key Methods:**

#### `updateStock(params)`

Updates stock level with adjustment tracking.

```typescript
const result = await inventory.updateStock({
  productId: 'product-001',
  adjustment: 50,  // +50 units
  reason: 'delivery',
  referenceId: 'delivery-2026-04-06-001',
  actor: 'warehouse-001'
});
```

**Returns:**
```typescript
{
  newQuantity: number,
  alertCreated: boolean  // True if below reorder threshold
}
```

#### `createSnapshot()`

Creates inventory snapshot for comparison.

```typescript
const result = await inventory.createSnapshot();
```

**Returns:**
```typescript
{
  snapshotId: number,
  discrepancyDetected: boolean  // True if >5% deviation
}
```

#### `getProductsBelowThreshold()`

Returns products below reorder threshold.

```typescript
const lowStock = await inventory.getProductsBelowThreshold();
```

## Database Schema

### PostgreSQL Tables

#### `orders`

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  products JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT
);
```

#### `inventory_items`

```sql
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reorder_threshold NUMERIC NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL,
  location TEXT
);
```

#### `inventory_snapshots`

```sql
CREATE TABLE inventory_snapshots (
  id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,
  snapshot_date TIMESTAMPTZ NOT NULL,
  items JSONB NOT NULL,
  discrepancy_detected BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

#### `inventory_alerts`

```sql
CREATE TABLE inventory_alerts (
  id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,  -- 'low_stock', 'discrepancy', 'threshold_breach'
  severity TEXT NOT NULL,     -- 'warning', 'critical'
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
```

#### `haccp_readings`

```sql
CREATE TABLE haccp_readings (
  id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,
  ccp_id TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  within_limits BOOLEAN NOT NULL,
  logged_by TEXT NOT NULL,
  documentation_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
```

#### `haccp_violations`

```sql
CREATE TABLE haccp_violations (
  id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,
  ccp_id TEXT NOT NULL,
  reading_id INTEGER NOT NULL,
  deviation NUMERIC NOT NULL,
  severity TEXT NOT NULL,      -- 'minor', 'critical', 'severe'
  flagged_for_review BOOLEAN NOT NULL,
  escalated_to TEXT,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
```

### Event Log (PostgreSQL)

All state transitions are logged to the `events` table:

```sql
-- Order events
INSERT INTO events (group_id, event_type, agent_id, metadata, status)
VALUES ('allura-faith-meats', 'faith-meats.order.created', ...);

-- HACCP events
INSERT INTO events (group_id, event_type, agent_id, metadata, status)
VALUES ('allura-faith-meats', 'haccp.reading.CCP-1', ...);
INSERT INTO events (group_id, event_type, agent_id, metadata, status)
VALUES ('allura-faith-meats', 'haccp.violation.CCP-3', ...);

-- Inventory events
INSERT INTO events (group_id, event_type, agent_id, metadata, status)
VALUES ('allura-faith-meats', 'inventory.alert_created', ...);
```

### Neo4j Knowledge Graph

**Relationship Patterns:**

```cypher
// Customer → Order → Product
CREATE (c:Customer {group_id: 'allura-faith-meats', customer_id: 'customer-123'})
CREATE (o:Order {group_id: 'allura-faith-meats', order_id: 'order-456'})
CREATE (p:Product {group_id: 'allura-faith-meats', product_id: 'product-789'})
CREATE (c)-[:PLACED_ORDER {group_id: 'allura-faith-meats'}]->(o)
CREATE (o)-[:CONTAINS_PRODUCT {group_id: 'allura-faith-meats', quantity: 2}]->(p)

// CCP → Reading → Verification
CREATE (ccp:CCP {group_id: 'allura-faith-meats', ccp_id: 'CCP-1'})
CREATE (r:Reading {group_id: 'allura-faith-meats', reading_id: 'reading-123'})
CREATE (ccp)-[:LOGGED {group_id: 'allura-faith-meats'}]->(r)
```

## Group ID Enforcement

All operations enforce `group_id: allura-faith-meats` tenant isolation:

```typescript
// In constructor
this.groupId = validateGroupId(this.config.group_id);

// In all database queries
WHERE group_id = $1  -- Always parameterized with this.groupId
```

**Validation Rules:**
- Must start with `allura-` prefix
- Lowercase only (NFR11 compliance)
- 2-64 characters
- Alphanumeric, hyphens, underscores

## Testing

### Test File

**Location:** `src/workflows/faith-meats.test.ts`

### Test Categories

1. **Order Lifecycle Tests**
   - Create order with sufficient inventory
   - Reject order with insufficient inventory
   - Cancel order and restore inventory
   - Invalid status transitions

2. **HACCP Compliance Tests**
   - Valid CCP readings within limits
   - CCP readings outside thresholds create violations
   - Violation resolution workflow

3. **Inventory Management Tests**
   - Stock updates with threshold alerts
   - Snapshot creation and discrepancy detection
   - Low stock alerts

4. **BI Reporting Tests**
   - Monthly order volume aggregation
   - Inventory status report
   - HACCP compliance summary
   - Product sales ranking
   - Customer order history

5. **Group ID Enforcement Tests**
   - Cross-tenant isolation
   - Invalid group_id rejection

## Usage Example

```typescript
import { createFaithMeatsOperations } from '@/workflows/faith-meats';

// Initialize with configuration
const ops = createFaithMeatsOperations({
  group_id: 'allura-faith-meats',
  agentId: 'faith-meats-agent'
});

// Process an order
const orderResult = await ops.processOrder({
  customerId: 'customer-123',
  products: [
    {
      productId: 'product-001',
      productName: 'Beef Jerky Original',
      quantity: 5,
      unitPrice: 12.99
    },
    {
      productId: 'product-002',
      productName: 'Turkey Jerky',
      quantity: 3,
      unitPrice: 11.99
    }
  ],
  notes: 'Express delivery requested'
});

console.log(`Order created: ${orderResult.orderId}`);
console.log(`Status: ${orderResult.status}`);

// Update order status
await ops.updateOrderStatus(orderResult.orderId, 'processing');
await ops.updateOrderStatus(orderResult.orderId, 'shipped');
await ops.updateOrderStatus(orderResult.orderId, 'delivered');

// Check HACCP compliance
const complianceResult = await ops.checkCCPCompliance({
  productionRunId: 'batch-2026-04-06-001',
  readings: [
    { ccpId: 'CCP-1', value: 2, unit: 'celsius', operatorId: 'operator-001', timestamp: new Date() },
    { ccpId: 'CCP-2', value: -15, unit: 'celsius', operatorId: 'operator-001', timestamp: new Date() },
    { ccpId: 'CCP-3', value: 70, unit: 'celsius', operatorId: 'operator-001', timestamp: new Date() }
  ]
});

if (!complianceResult.compliant) {
  console.log(`HACCP violations detected: ${complianceResult.violations.length}`);
  complianceResult.violations.forEach(v => {
    console.log(`  ${v.ccpId}: ${v.deviation}`);
  });
}

// Generate BI report
const monthlyReport = await ops.generateBIReport('monthly_order_volume', {
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31')
});

console.log(monthlyReport.summary);
console.log(JSON.stringify(monthlyReport.data, null, 2));
```

## BehaviorSpec Compliance

This implementation follows the Faith Meats BehaviorSpec (`behavior-specs/faith-meats.yaml`):

### Capability Surface

✅ `inventory_read` - Inventory queries via `InventoryManager.getAllInventory()`
✅ `inventory_write` - Stock updates via `InventoryManager.updateStock()`
✅ `haccp_log` - CCP readings via `HACCPCompliance.recordReading()`
✅ `order_process` - Order lifecycle via `FaithMeatsOperations.processOrder()`
✅ `bi_query` - Reports via `FaithMeatsOperations.generateBIReport()`
✅ `memory_query` - Event log queries
✅ `memory_log` - Event logging via `logEvent()`

### Data Retention Policies

✅ HACCP logs: 7 years (enforced by separate `haccp_readings` table)
✅ Inventory snapshots: 90 days (enforced by cleanup job)
✅ Order history: 3 years (enforced by archive job)

### Lifecycle Hooks

✅ `before_work` - Inventory availability check, HACCP validation
✅ `during_work` - Inventory updates, HACCP readings logged
✅ `after_work` - BI report generation, alert notifications

### Governance

✅ HITL required for:
   - Violation resolution
   - Alert acknowledgment
   - Inventory discrepancy resolution

✅ Audit trail maintained in PostgreSQL `events` table (append-only)

## Monitoring & Alerts

### Operational Metrics

- Order processing success rate
- HACCP violation rate by CCP
- Inventory threshold breach frequency
- Snapshot discrepancy rate

### Alert Queuing

Alerts are logged to PostgreSQL `inventory_alerts` table and queued for Paperclip dashboard notification:

```typescript
// Alert creation in InventoryManager
await pool.query(`
  INSERT INTO inventory_alerts (
    group_id, product_id, alert_type, severity, message, acknowledged
  ) VALUES ($1, $2, $3, $4, $5, false)
`, [this.groupId, productId, 'low_stock', 'warning', 'Stock level below threshold']);
```

Paperclip integration would poll this table for unacknowledged alerts.

## Future Enhancements

### Payload CMS Integration (Out of Scope for v1)

BehaviorSpec defines collections but Payload CMS integration is deferred:

```yaml
# Future: Payload CMS collections
collections:
  - products
  - flavors
  - certifications
  - inventory
  - orders
```

### Cross-Tenant BI Dashboards (Requires Security Review)

- Aggregate metrics across multiple tenants
- Requires security review for tenant isolation
- Anonymization and access control policies

## References

- **BehaviorSpec:** `_bmad-output/implementation-artifacts/behavior-specs/faith-meats.yaml`
- **Tech Spec:** `_bmad-output/implementation-artifacts/spec-6-2-faith-meats-operations.md`
- **Tenant Boundary:** `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md`
- **Reference Pattern:** `src/workflows/notion-sync.ts`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-06 | Initial implementation |

---

**Last Updated:** 2026-04-06  
**Status:** Implementation Complete  
**Next Steps:** Test suite implementation