# Foreign Key Dependency Audit - 2026-04-04

**Generated**: 2026-04-04
**Context**: Memory system cleanup - Action 4
**Decision by**: Architect (Sabir Asheed)

## Summary

Total non-core tables audited: **28 tables**

### Category 1: FK to Core Tables (DEFER - DO NOT MIGRATE)

These tables have foreign keys to core memory tables (`agents` or `events`) and **MUST NOT be migrated** without careful planning:

| Table | Constraint | References Core | Action |
|-------|------------|-----------------|--------|
| aegis_audit_log | aegis_audit_log_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| agent_approvals | agent_approvals_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| agent_contracts | agent_contracts_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| agent_usage | agent_usage_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| agent_versions | agent_versions_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| budget_tracking | budget_tracking_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| heartbeat_checkpoints | heartbeat_checkpoints_agent_id_fkey | agents | ❌ DEFER - Document dependency |
| outcomes | outcomes_event_id_fkey | events | ❌ DEFER - Document dependency |

**Count**: 8 tables with FK to core

### Category 2: FK to Non-Core Tables

These tables have FK to other non-core tables. Can be prefixed with `legacy_` **IF** the referenced table is also migrated:

| Table | Constraint | References | Action |
|-------|------------|------------|--------|
| certifications | certifications_supplier_id_fkey | suppliers | ⚠️ Prefix only if suppliers prefixed |
| curator_queue | curator_queue_run_id_fkey | adas_runs | ⚠️ Prefix only if adas_runs prefixed |
| invoice_items | invoice_items_invoice_id_fkey | invoices | ⚠️ Prefix only if invoices prefixed |
| invoices | invoices_customer_id_fkey | customers | ⚠️ Prefix only if customers prefixed |
| notion_sync_log | notion_sync_log_run_id_fkey | adas_runs | ⚠️ Prefix only if adas_runs prefixed |
| payments | payments_invoice_id_fkey | invoices | ⚠️ Prefix only if invoices prefixed |
| supplier_pricing | supplier_pricing_supplier_id_fkey | suppliers | ⚠️ Prefix only if suppliers prefixed |

**Count**: 7 tables with FK to non-core

### Category 3: No Foreign Keys (CAN PREFIX)

These tables have NO foreign keys and can be safely renamed to `legacy_` prefix:

```sql
-- Tables with NO FK constraints (from audit)
-- Safe to rename
ALTER TABLE customers RENAME TO legacy_customers;
ALTER TABLE design_sync_status RENAME TO legacy_design_sync_status;
ALTER TABLE adas_runs RENAME TO legacy_adas_runs; -- Note: Referenced by curator_queue, notion_sync_log
ALTER TABLE session_logs RENAME TO legacy_session_logs;
ALTER TABLE shipping_containers RENAME TO legacy_shipping_containers;
ALTER TABLE suppliers RENAME TO legacy_suppliers; -- Note: Referenced by certifications, supplier_pricing
ALTER TABLE supply_chain_blockers RENAME TO legacy_supply_chain_blockers;
ALTER TABLE sync_drift_log RENAME TO legacy_sync_drift_log;
ALTER TABLE tenants RENAME TO legacy_tenants;
ALTER TABLE v_budget_alerts RENAME TO legacy_v_budget_alerts; -- View
ALTER TABLE v_sync_drift RENAME TO legacy_v_sync_drift; -- View
```

**Count**: 11 tables with no FK constraints (potentially more)

**Note**: Tables referencing core or non-core tables should be migrated TOGETHER with their dependencies in a single transaction.

## Architectural Decision

Per architect decision on 2026-04-04:

1. ✅ **Do not migrate** the 8 tables with FK to core (`agents`, `events`)
2. ⚠️ **Audit FK chain** for the 7 tables with FK to non-core before prefixing
3. ✅ **Safe to prefix** the 11 tables with no FK, **BUT** check for application dependencies first
4. 📅 **Defer until** the core memory system is stable and schema constraints are enforced

## Recommended Migration Order

1. First: Add application-layer validation (invariant-validation.ts)
2. Second: Cleanup orphaned nodes and test events (already done)
3. Third: Run FK audit on application code to ensure no runtime breakage
4. Fourth: Migrate non-core tables to `legacy_` schema (if confirmed unused)
5. Fifth: Document core tables that depend on non-core (defer)

## Next Steps

- [ ] Audit application code for references to Category 3 tables
- [ ] Document Category 1 tables in Backend Governance & Ops
- [ ] Create migration script for Category 3 tables (if confirmed unused)
- [ ] Schedule weekly audit (every Sunday 02:00 UTC)

---

**Reviewed by**: Memory Infrastructure
**Approved by**: Memory Architect
**Action**: DEFER non-core table migration until application dependency audit complete