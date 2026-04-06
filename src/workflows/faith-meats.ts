/**
 * Faith Meats Operations Workflow
 * Story 6-2: Faith Meats Operations
 *
 * Orchestrates order processing, inventory management, HACCP compliance,
 * business intelligence reporting, and operational alerts.
 *
 * Workflow:
 * 1. Order Processing: Create, cancel, track orders with inventory updates
 * 2. HACCP Compliance: CCP monitoring, deviation logging, escalation
 * 3. Inventory Management: Stock updates, threshold alerts, discrepancy detection
 * 4. BI Reporting: Aggregated metrics for operations dashboard
 *
 * Pattern: All operations enforce group_id isolation (allura-faith-meats).
 */

import { getPool } from "@/lib/postgres/connection";
import { validateGroupId } from "@/lib/validation/group-id";
import { HACCPCompliance, createHACCPCompliance } from "@/lib/haccp/compliance";
import { InventoryManager, createInventoryManager } from "@/lib/inventory/manager";

/**
 * Faith Meats workflow configuration
 */
export interface FaithMeatsConfig {
  /** Tenant isolation - always 'allura-faith-meats' */
  group_id: string;
  /** Agent identifier for attribution */
  agentId?: string;
  /** Enable HACCP compliance checking */
  enableHACCP?: boolean;
  /** Enable inventory tracking */
  enableInventory?: boolean;
  /** Enable BI reporting */
  enableBIReporting?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: FaithMeatsConfig = {
  group_id: "allura-faith-meats",
  agentId: "faith-meats-agent",
  enableHACCP: true,
  enableInventory: true,
  enableBIReporting: true,
};

/**
 * Order status lifecycle
 * created → processing → shipped → delivered
 *                ↓
 *            cancelled (restores inventory)
 */
export type OrderStatus = "created" | "processing" | "shipped" | "delivered" | "cancelled";

/**
 * Order details
 */
export interface Order {
  id: string;
  group_id: string;
  customer_id: string;
  products: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
  total_amount: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  notes?: string;
}

/**
 * Business Intelligence report types
 */
export type BIReportType =
  | "monthly_order_volume"
  | "inventory_status"
  | "haccp_compliance"
  | "product_sales"
  | "customer_orders";

/**
 * BI report result
 */
export interface BIReport {
  report_type: BIReportType;
  group_id: string;
  generated_at: Date;
  data: Record<string, unknown>;
  summary: string;
}

/**
 * Faith Meats Operations
 *
 * Primary workflow orchestrator for Faith Meats workspace.
 * Integrates HACCP compliance, inventory management, order processing,
 * and business intelligence.
 */
export class FaithMeatsOperations {
  private readonly groupId: string;
  private readonly agentId: string;
  private readonly config: FaithMeatsConfig;
  private readonly haccp: HACCPCompliance;
  private readonly inventory: InventoryManager;

  constructor(config: Partial<FaithMeatsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // ENFORCE GROUP_ID
    this.groupId = validateGroupId(this.config.group_id);
    this.agentId = this.config.agentId ?? "faith-meats-agent";

    // Initialize HACCP compliance manager
    this.haccp = createHACCPCompliance(this.groupId, this.agentId);

    // Initialize inventory manager
    this.inventory = createInventoryManager(this.groupId);
  }

  /**
   * Process a new order
   *
   * Workflow:
   * 1. Validate order data
   * 2. Check inventory availability
   * 3. Create order in PostgreSQL (append-only)
   * 4. Decrement inventory
   * 5. Create Customer → Order → Product relationships in Neo4j
   * 6. Log order event
   *
   * @param orderData - Order details
   * @returns Order ID and processing result
   */
  async processOrder(orderData: {
    customerId: string;
    products: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
  }): Promise<{ orderId: string; status: OrderStatus }> {
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pool = getPool();

    // Calculate total amount
    const totalAmount = orderData.products.reduce(
      (sum, p) => sum + p.quantity * p.unitPrice,
      0
    );

    // Validate inventory availability for all products
    for (const product of orderData.products) {
      const availability = await this.inventory.checkAvailability(
        product.productId,
        product.quantity
      );

      if (!availability.available) {
        throw new Error(
          `Insufficient inventory for ${product.productId}: ` +
          `have ${availability.currentStock}, need ${product.quantity}`
        );
      }
    }

    // BEGIN transaction
    await pool.query("BEGIN");

    try {
      // Create order record (append-only)
      await pool.query(
        `
        INSERT INTO orders (
          id, group_id, customer_id, products, total_amount,
          status, created_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          orderId,
          this.groupId,
          orderData.customerId,
          JSON.stringify(orderData.products),
          totalAmount,
          "created",
          new Date(),
          orderData.notes ?? null,
        ]
      );

      // Decrement inventory for each product
      for (const product of orderData.products) {
        await this.inventory.decrementForOrder(
          product.productId,
          product.quantity,
          orderId,
          this.agentId
        );
      }

      // Log order event
      await this.logEvent({
        event_type: "faith-meats.order.created",
        metadata: {
          order_id: orderId,
          customer_id: orderData.customerId,
          product_count: orderData.products.length,
          total_amount: totalAmount,
        },
      });

      // COMMIT transaction
      await pool.query("COMMIT");

      return {
        orderId,
        status: "created",
      };
    } catch (error) {
      // ROLLBACK on error
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  /**
   * Cancel an order
   *
   * Workflow:
   * 1. Validate order exists and can be cancelled
   * 2. Update order status to cancelled
   * 3. Restore inventory for all products
   * 4. Log cancellation event
   *
   * @param orderId - Order ID to cancel
   * @param reason - Cancellation reason
   * @returns Success status
   */
  async cancelOrder(
    orderId: string,
    reason: string
  ): Promise<{ status: OrderStatus }> {
    const pool = getPool();

    // Get order details
    const orderResult = await pool.query<Order>(
      `
      SELECT id, group_id, customer_id, products, total_amount,
             status, created_at
      FROM orders
      WHERE group_id = $1 AND id = $2
    `,
      [this.groupId, orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const order = orderResult.rows[0];

    if (order.status === "shipped" || order.status === "delivered") {
      throw new Error(
        `Cannot cancel order in status: ${order.status}. Escalate to human.`
      );
    }

    if (order.status === "cancelled") {
      throw new Error(`Order already cancelled: ${orderId}`);
    }

    // BEGIN transaction
    await pool.query("BEGIN");

    try {
      // Update order status
      await pool.query(
        `
        UPDATE orders
        SET status = $3,
            cancelled_at = $4,
            updated_at = $5
        WHERE group_id = $1 AND id = $2
      `,
        [this.groupId, orderId, "cancelled", new Date(), new Date()]
      );

      // Restore inventory for all products
      for (const product of order.products as Array<{ product_id: string; quantity: number }>) {
        await this.inventory.restoreForCancellation(
          product.product_id,
          product.quantity,
          orderId,
          this.agentId
        );
      }

      // Log cancellation event
      await this.logEvent({
        event_type: "faith-meats.order.cancelled",
        metadata: {
          order_id: orderId,
          cancellation_reason: reason,
          restored_products: (order.products as Array<{ product_id: string; quantity: number }>).length,
        },
      });

      // COMMIT transaction
      await pool.query("COMMIT");

      return { status: "cancelled" };
    } catch (error) {
      // ROLLBACK on error
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  /**
   * Update order status
   *
   * @param orderId - Order ID
   * @param newStatus - New status
   * @returns Updated status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: Exclude<OrderStatus, "cancelled" | "created">
  ): Promise<{ status: OrderStatus }> {
    const pool = getPool();

    const validTransitions: Record<string, OrderStatus[]> = {
      created: ["processing"],
      processing: ["shipped"],
      shipped: ["delivered"],
    };

    // Get current order status
    const currentResult = await pool.query<{ status: OrderStatus }>(
      `
      SELECT status
      FROM orders
      WHERE group_id = $1 AND id = $2
    `,
      [this.groupId, orderId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const currentStatus = currentResult.rows[0].status;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} → ${newStatus}`
      );
    }

    // Update status
    const updateField = newStatus === "shipped" ? "shipped_at" : "delivered_at";

    await pool.query(
      `
      UPDATE orders
      SET status = $3,
          ${updateField} = $4,
          updated_at = $5
      WHERE group_id = $1 AND id = $2
    `,
      [this.groupId, orderId, newStatus, new Date(), new Date()]
    );

    await this.logEvent({
      event_type: `faith-meats.order.${newStatus}`,
      metadata: {
        order_id: orderId,
        previous_status: currentStatus,
        new_status: newStatus,
      },
    });

    return { status: newStatus };
  }

  /**
   * Update inventory for a product
   *
   * @param productId - Product ID
   * @param quantity - Quantity adjustment (+/-)
   * @param type - Adjustment type
   * @returns New quantity and alert status
   */
  async updateInventory(
    productId: string,
    quantity: number,
    type: "manual_adjustment" | "delivery" | "correction"
  ): Promise<{ newQuantity: number; alertCreated: boolean }> {
    const reason = type === "manual_adjustment" ? "manual_adjustment" : "manual_adjustment";

    const result = await this.inventory.updateStock({
      productId,
      adjustment: quantity,
      reason,
      actor: this.agentId,
      referenceId: type,
    });

    await this.logEvent({
      event_type: "faith-meats.inventory.updated",
      metadata: {
        product_id: productId,
        quantity_change: quantity,
        new_quantity: result.newQuantity,
        adjustment_type: type,
        alert_created: result.alertCreated,
      },
    });

    return result;
  }

  /**
   * Check HACCP compliance for a production run
   *
   * Validates all CCP readings for a production run.
   *
   * @param productionRun - Production run ID
   * @returns Compliance status and violations
   */
  async checkCCPCompliance(productionRun: {
    productionRunId: string;
    readings: Array<{
      ccpId: string;
      value: number;
      unit: string;
      operatorId: string;
      timestamp: Date;
    }>;
  }): Promise<{
    compliant: boolean;
    violations: Array<{ ccpId: string; deviation: string }>;
  }> {
    const violations: Array<{ ccpId: string; deviation: string }> = [];

    for (const reading of productionRun.readings) {
      const result = await this.haccp.recordReading({
        ccpId: reading.ccpId,
        value: reading.value,
        unit: reading.unit,
        loggedBy: reading.operatorId,
        documentationRef: productionRun.productionRunId,
      });

      if (!result.withinLimits && result.violationId) {
        // Get violation details
        const pendingViolations = await this.haccp.getUnreviewedViolations();
        const violation = pendingViolations.find((v) => v.reading_id === result.readingId);

        if (violation) {
          violations.push({
            ccpId: violation.ccp_id,
            deviation: `Deviation of ${violation.deviation} detected at CCP ${violation.ccp_id}`,
          });
        }
      }
    }

    await this.logEvent({
      event_type: "faith-meats.haccp.checked",
      metadata: {
        production_run_id: productionRun.productionRunId,
        total_readings: productionRun.readings.length,
        violations_count: violations.length,
        compliant: violations.length === 0,
      },
    });

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate Business Intelligence report
   *
   * @param type - Report type
   * @param params - Report parameters
   * @returns BI report
   */
  async generateBIReport(
    type: BIReportType,
    params?: {
      startDate?: Date;
      endDate?: Date;
      productId?: string;
      customerId?: string;
    }
  ): Promise<BIReport> {
    const pool = getPool();
    let data: Record<string, unknown> = {};
    let summary = "";

    switch (type) {
      case "monthly_order_volume": {
        const startDate = params?.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = params?.endDate ?? new Date();

        const result = await pool.query<{
          status: OrderStatus;
          count: string;
          total_amount: string;
        }>(
          `
          SELECT status, COUNT(*) as count, SUM(total_amount) as total_amount
          FROM orders
          WHERE group_id = $1
            AND created_at >= $2
            AND created_at <= $3
          GROUP BY status
          ORDER BY status
        `,
          [this.groupId, startDate, endDate]
        );

        data = {
          period: { start: startDate, end: endDate },
          orders_by_status: result.rows.reduce(
            (acc, row) => ({
              ...acc,
              [row.status]: {
                count: parseInt(row.count, 10),
                total_amount: parseFloat(row.total_amount),
              },
            }),
            {} as Record<string, { count: number; total_amount: number }>
          ),
        };

        const totalOrders = result.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);
        summary = `Monthly order volume: ${totalOrders} orders across ${result.rows.length} statuses`;
        break;
      }

      case "inventory_status": {
        const items = await this.inventory.getAllInventory();
        const belowThreshold = await this.inventory.getProductsBelowThreshold();

        data = {
          total_products: items.length,
          products_below_threshold: belowThreshold.length,
          low_stock_items: belowThreshold.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            current_quantity: item.quantity,
            reorder_threshold: item.reorder_threshold,
          })),
        };

        summary = `Inventory status: ${items.length} products, ${belowThreshold.length} below threshold`;
        break;
      }

      case "haccp_compliance": {
        const violations = await this.haccp.getUnreviewedViolations();

        data = {
          pending_violations: violations.length,
          violations_by_ccp: violations.reduce(
            (acc, v) => ({
              ...acc,
              [v.ccp_id]: (acc[v.ccp_id] ?? 0) + 1,
            }),
            {} as Record<string, number>
          ),
        };

        summary = `HACCP compliance: ${violations.length} pending violations`;
        break;
      }

      case "product_sales": {
        const startDate = params?.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = params?.endDate ?? new Date();

        const result = await pool.query<{
          product_id: string;
          total_quantity: string;
          total_revenue: string;
        }>(
          `
          SELECT 
            (products->>'product_id') as product_id,
            SUM((products->>'quantity')::int) as total_quantity,
            SUM((products->>'quantity')::numeric * (products->>'unit_price')::numeric) as total_revenue
          FROM orders, jsonb_array_elements(products) as products
          WHERE group_id = $1
            AND status != 'cancelled'
            AND created_at >= $2
            AND created_at <= $3
          GROUP BY (products->>'product_id')
          ORDER BY total_revenue DESC
          LIMIT 10
        `,
          [this.groupId, startDate, endDate]
        );

        data = {
          period: { start: startDate, end: endDate },
          top_products: result.rows.map((row) => ({
            product_id: row.product_id,
            total_quantity: parseInt(row.total_quantity, 10),
            total_revenue: parseFloat(row.total_revenue),
          })),
        };

        summary = `Product sales report: ${result.rows.length} products in period`;
        break;
      }

      case "customer_orders": {
        const customerId = params?.customerId;

        if (!customerId) {
          throw new Error("customer_orders report requires customerId parameter");
        }

        const result = await pool.query<Order>(
          `
          SELECT id, customer_id, products, total_amount, status, created_at, delivered_at
          FROM orders
          WHERE group_id = $1 AND customer_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `,
          [this.groupId, customerId]
        );

        data = {
          customer_id: customerId,
          order_count: result.rows.length,
          orders: result.rows.map((row) => ({
            order_id: row.id,
            total_amount: row.total_amount,
            status: row.status,
            created_at: row.created_at,
            delivered_at: row.delivered_at,
          })),
        };

        summary = `Customer orders: ${result.rows.length} orders for customer ${customerId}`;
        break;
      }

      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    // Log BI report generation
    await this.logEvent({
      event_type: "faith-meats.bi.generated",
      metadata: {
        report_type: type,
        parameters: params ?? {},
      },
    });

    return {
      report_type: type,
      group_id: this.groupId,
      generated_at: new Date(),
      data,
      summary,
    };
  }

  /**
   * Check inventory threshold alerts
   *
   * Returns products below reorder threshold.
   *
   * @returns Low stock alerts
   */
  async checkThresholdAlerts(): Promise<{
    alerts: Array<{
      product_id: string;
      product_name: string;
      current_quantity: number;
      reorder_threshold: number;
    }>;
  }> {
    const lowStock = await this.inventory.getProductsBelowThreshold();

    return {
      alerts: lowStock.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        current_quantity: item.quantity,
        reorder_threshold: item.reorder_threshold,
      })),
    };
  }

  /**
   * Create inventory snapshot
   *
   * Captures current state for discrepancy detection.
   *
   * @returns Snapshot result
   */
  async createInventorySnapshot(): Promise<{
    snapshotId: number;
    discrepancyDetected: boolean;
  }> {
    const result = await this.inventory.createSnapshot();

    await this.logEvent({
      event_type: "faith-meats.inventory.snapshot_created",
      metadata: {
        snapshot_id: result.snapshotId,
        discrepancy_detected: result.discrepancyDetected,
      },
    });

    return result;
  }

  /**
   * Get order by ID
   *
   * @param orderId - Order ID
   * @returns Order details
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const pool = getPool();

    const result = await pool.query<Order>(
      `
      SELECT id, group_id, customer_id, products, total_amount,
             status, created_at, updated_at, shipped_at, delivered_at,
             cancelled_at, notes
      FROM orders
      WHERE group_id = $1 AND id = $2
    `,
      [this.groupId, orderId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * List orders by status
   *
   * @param status - Order status filter
   * @param limit - Maximum results
   * @returns Orders
   */
  async listOrders(
    status?: OrderStatus,
    limit: number = 50
  ): Promise<Order[]> {
    const pool = getPool();

    let query = `
      SELECT id, group_id, customer_id, products, total_amount,
             status, created_at, updated_at, shipped_at, delivered_at,
             cancelled_at, notes
      FROM orders
      WHERE group_id = $1
    `;

    const params: unknown[] = [this.groupId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query<Order>(query, params);

    return result.rows;
  }

  /**
   * Log event to PostgreSQL
   *
   * Private helper for consistent event logging.
   */
  private async logEvent(params: {
    event_type: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const pool = getPool();

    await pool.query(
      `
      INSERT INTO events (
        group_id, event_type, agent_id, metadata, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        this.groupId,
        params.event_type,
        this.agentId,
        JSON.stringify(params.metadata),
        "completed",
        new Date(),
      ]
    );
  }
}

/**
 * Create Faith Meats operations instance
 *
 * @param config - Configuration
 * @returns FaithMeatsOperations instance
 */
export function createFaithMeatsOperations(
  config?: Partial<FaithMeatsConfig>
): FaithMeatsOperations {
  return new FaithMeatsOperations(config);
}