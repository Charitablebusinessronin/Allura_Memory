/**
 * Inventory Manager Module
 * Story 6-2: Faith Meats Operations
 *
 * Manages stock levels, threshold alerts, and discrepancy detection.
 * Follows BehaviorSpec with 90-day inventory snapshot cycle.
 */

import { getPool } from "@/lib/postgres/connection";
import { validateGroupId } from "@/lib/validation/group-id";

/**
 * Inventory item
 */
export interface InventoryItem {
  id: string;
  group_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  reorder_threshold: number;
  last_updated: Date;
  location?: string;
}

/**
 * Inventory snapshot for comparison
 */
export interface InventorySnapshot {
  id: number;
  group_id: string;
  snapshot_date: Date;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  discrepancy_detected: boolean;
  created_at: Date;
}

/**
 * Inventory alert
 */
export interface InventoryAlert {
  id: number;
  group_id: string;
  product_id: string;
  alert_type: "low_stock" | "discrepancy" | "threshold_breach";
  severity: "warning" | "critical";
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  resolved_at?: Date;
  created_at: Date;
}

/**
 * Stock adjustment record
 */
export interface StockAdjustment {
  group_id: string;
  product_id: string;
  adjustment: number;
  reason: "order_created" | "order_cancelled" | "manual_adjustment" | "snapshot_correction";
  reference_id?: string;
  actor: string;
  timestamp: Date;
}

/**
 * Inventory Manager
 *
 * Provides stock updates, threshold alerts, and snapshot comparison.
 * All operations enforce group_id isolation for multi-tenant safety.
 */
export class InventoryManager {
  private readonly groupId: string;

  constructor(groupId: string) {
    this.groupId = validateGroupId(groupId);
  }

  /**
   * Get current inventory for a product
   */
  async getInventory(productId: string): Promise<InventoryItem | null> {
    const pool = getPool();
    const result = await pool.query<InventoryItem>(
      `
      SELECT id, group_id, product_id, product_name, sku, quantity, unit,
             reorder_threshold, last_updated, location
      FROM inventory_items
      WHERE group_id = $1 AND product_id = $2
      `,
      [this.groupId, productId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Get all inventory items
   */
  async getAllInventory(): Promise<InventoryItem[]> {
    const pool = getPool();
    const result = await pool.query<InventoryItem>(
      `
      SELECT id, group_id, product_id, product_name, sku, quantity, unit,
             reorder_threshold, last_updated, location
      FROM inventory_items
      WHERE group_id = $1
      ORDER BY product_name
      `,
      [this.groupId]
    );

    return result.rows;
  }

  /**
   * Update stock level
   *
   * Creates adjustment record for audit trail.
   * Checks threshold and creates alert if below reorder point.
   */
  async updateStock(params: {
    productId: string;
    adjustment: number;
    reason: StockAdjustment["reason"];
    referenceId?: string;
    actor: string;
  }): Promise<{ newQuantity: number; alertCreated: boolean }> {
    const pool = getPool();

    await pool.query("BEGIN");

    try {
      const currentResult = await pool.query<{ quantity: number }>(
        `
        UPDATE inventory_items
        SET quantity = quantity + $3,
            last_updated = $4
        WHERE group_id = $1 AND product_id = $2
        RETURNING quantity
        `,
        [this.groupId, params.productId, params.adjustment, new Date()]
      );

      if (currentResult.rows.length === 0) {
        await pool.query("ROLLBACK");
        throw new Error(`Product not found: ${params.productId}`);
      }

      const newQuantity = currentResult.rows[0].quantity;

      await this.logAdjustment({
        ...params,
        newQuantity,
      });

      const itemResult = await pool.query<{ reorder_threshold: number }>(
        `
        SELECT reorder_threshold
        FROM inventory_items
        WHERE group_id = $1 AND product_id = $2
        `,
        [this.groupId, params.productId]
      );

      const reorderThreshold = itemResult.rows[0]?.reorder_threshold ?? 0;
      const alertCreated = newQuantity < reorderThreshold;

      if (alertCreated) {
        await this.createAlert({
          productId: params.productId,
          alertType: "low_stock",
          severity: newQuantity < reorderThreshold / 2 ? "critical" : "warning",
          message: `Stock level ${newQuantity} below reorder threshold ${reorderThreshold}`,
        });
      }

      await pool.query("COMMIT");

      return { newQuantity, alertCreated };
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  /**
   * Decrement stock for order
   */
  async decrementForOrder(
    productId: string,
    quantity: number,
    orderId: string,
    actor: string
  ): Promise<{ newQuantity: number; alertCreated: boolean }> {
    const current = await this.getInventory(productId);
    if (!current) {
      throw new Error(`Product not found: ${productId}`);
    }

    if (current.quantity < quantity) {
      throw new Error(
        `Insufficient inventory: have ${current.quantity}, need ${quantity}`
      );
    }

    return this.updateStock({
      productId,
      adjustment: -quantity,
      reason: "order_created",
      referenceId: orderId,
      actor,
    });
  }

  /**
   * Restore stock for cancelled order
   */
  async restoreForCancellation(
    productId: string,
    quantity: number,
    orderId: string,
    actor: string
  ): Promise<number> {
    const result = await this.updateStock({
      productId,
      adjustment: quantity,
      reason: "order_cancelled",
      referenceId: orderId,
      actor,
    });

    return result.newQuantity;
  }

  /**
   * Create inventory snapshot
   *
   * Captures current state for comparison and discrepancy detection.
   */
  async createSnapshot(): Promise<{ snapshotId: number; discrepancyDetected: boolean }> {
    const pool = getPool();
    const snapshotDate = new Date();

    const inventory = await this.getAllInventory();
    const items = inventory.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    const previousSnapshot = await this.getPreviousSnapshot();

    let discrepancyDetected = false;
    if (previousSnapshot) {
      discrepancyDetected = this.detectDiscrepancy(previousSnapshot.items, items);
    }

    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO inventory_snapshots (
        group_id, snapshot_date, items, discrepancy_detected, created_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [this.groupId, snapshotDate, JSON.stringify(items), discrepancyDetected, new Date()]
    );

    const snapshotId = result.rows[0].id;

    if (discrepancyDetected) {
      await this.createAlert({
        productId: "system",
        alertType: "discrepancy",
        severity: "critical",
        message: `Inventory discrepancy detected in snapshot ${snapshotId}. Compare to previous snapshot.`,
      });
    }

    return { snapshotId, discrepancyDetected };
  }

  /**
   * Get previous snapshot for comparison
   */
  private async getPreviousSnapshot(): Promise<InventorySnapshot | null> {
    const pool = getPool();
    const result = await pool.query<InventorySnapshot>(
      `
      SELECT id, group_id, snapshot_date, items, discrepancy_detected, created_at
      FROM inventory_snapshots
      WHERE group_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 1
      `,
      [this.groupId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Detect discrepancy between snapshots
   *
   * Flags if any item deviates more than 5% from previous.
   */
  private detectDiscrepancy(
    previous: Array<{ product_id: string; quantity: number }>,
    current: Array<{ product_id: string; quantity: number }>
  ): boolean {
    const previousMap = new Map(previous.map((p) => [p.product_id, p.quantity]));

    for (const item of current) {
      const prevQuantity = previousMap.get(item.product_id);
      if (prevQuantity === undefined) continue;

      const deviation = Math.abs(item.quantity - prevQuantity) / Math.max(prevQuantity, 1);
      if (deviation > 0.05) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get snapshot history
   */
  async getSnapshotHistory(limit: number = 30): Promise<InventorySnapshot[]> {
    const pool = getPool();
    const result = await pool.query<InventorySnapshot>(
      `
      SELECT id, group_id, snapshot_date, items, discrepancy_detected, created_at
      FROM inventory_snapshots
      WHERE group_id = $1
      ORDER BY snapshot_date DESC
      LIMIT $2
      `,
      [this.groupId, limit]
    );

    return result.rows;
  }

  /**
   * Create inventory alert
   */
  private async createAlert(params: {
    productId: string;
    alertType: InventoryAlert["alert_type"];
    severity: InventoryAlert["severity"];
    message: string;
  }): Promise<number> {
    const pool = getPool();

    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO inventory_alerts (
        group_id, product_id, alert_type, severity, message,
        acknowledged, created_at
      ) VALUES ($1, $2, $3, $4, $5, false, $6)
      RETURNING id
      `,
      [this.groupId, params.productId, params.alertType, params.severity, params.message, new Date()]
    );

    await pool.query(
      `
      INSERT INTO events (
        group_id, event_type, agent_id, metadata, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        this.groupId,
        "inventory.alert_created",
        "inventory-manager",
        JSON.stringify({
          alert_id: result.rows[0].id,
          product_id: params.productId,
          alert_type: params.alertType,
          severity: params.severity,
          message: params.message,
        }),
        "completed",
        new Date(),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get unacknowledged alerts
   */
  async getUnacknowledgedAlerts(): Promise<InventoryAlert[]> {
    const pool = getPool();
    const result = await pool.query<InventoryAlert>(
      `
      SELECT id, group_id, product_id, alert_type, severity,
             message, acknowledged, acknowledged_by, resolved_at, created_at
      FROM inventory_alerts
      WHERE group_id = $1
        AND acknowledged = false
        AND resolved_at IS NULL
      ORDER BY created_at DESC
      `,
      [this.groupId]
    );

    return result.rows;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: number, acknowledgedBy: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `
      UPDATE inventory_alerts
      SET acknowledged = true,
          acknowledged_by = $3,
          updated_at = $4
      WHERE id = $1 AND group_id = $2
      `,
      [alertId, this.groupId, acknowledgedBy, new Date()]
    );
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: number): Promise<void> {
    const pool = getPool();
    await pool.query(
      `
      UPDATE inventory_alerts
      SET resolved_at = $3,
          updated_at = $4
      WHERE id = $1 AND group_id = $2
      `,
      [alertId, this.groupId, new Date(), new Date()]
    );
  }

  /**
   * Log stock adjustment for audit trail
   */
  private async logAdjustment(params: {
    productId: string;
    adjustment: number;
    reason: StockAdjustment["reason"];
    referenceId?: string;
    newQuantity: number;
    actor: string;
  }): Promise<void> {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO inventory_adjustments (
        group_id, product_id, adjustment, reason,
        reference_id, new_quantity, actor, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        this.groupId,
        params.productId,
        params.adjustment,
        params.reason,
        params.referenceId ?? null,
        params.newQuantity,
        params.actor,
        new Date(),
      ]
    );
  }

  /**
   * Get adjustment history for a product
   */
  async getAdjustmentHistory(
    productId: string,
    limit: number = 50
  ): Promise<StockAdjustment[]> {
    const pool = getPool();
    const result = await pool.query<StockAdjustment>(
      `
      SELECT group_id, product_id, adjustment, reason,
             reference_id, actor, created_at as timestamp
      FROM inventory_adjustments
      WHERE group_id = $1 AND product_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [this.groupId, productId, limit]
    );

    return result.rows;
  }

  /**
   * Check if product has sufficient stock
   */
  async checkAvailability(
    productId: string,
    requestedQuantity: number
  ): Promise<{ available: boolean; currentStock: number }> {
    const item = await this.getInventory(productId);
    const currentStock = item?.quantity ?? 0;

    return {
      available: currentStock >= requestedQuantity,
      currentStock,
    };
  }

  /**
   * Get products below reorder threshold
   */
  async getProductsBelowThreshold(): Promise<InventoryItem[]> {
    const pool = getPool();
    const result = await pool.query<InventoryItem>(
      `
      SELECT id, group_id, product_id, product_name, sku, quantity, unit,
             reorder_threshold, last_updated, location
      FROM inventory_items
      WHERE group_id = $1
        AND quantity < reorder_threshold
      ORDER BY quantity ASC
      `,
      [this.groupId]
    );

    return result.rows;
  }
}

/**
 * Create inventory manager instance
 */
export function createInventoryManager(groupId: string): InventoryManager {
  return new InventoryManager(groupId);
}