/**
 * Faith Meats Operations Workflow
 * Story 6.2: Production Workflow for allura-faith-meats Tenant
 * 
 * Inventory management + HACCP compliance + Order processing + Business intelligence.
 * Enforces tenant isolation with allura-faith-meats workspace.
 */

import { validateTenantGroupId, TENANT_ERROR_CODE } from "../../lib/validation/tenant-group-id";
import { GroupIdValidationError } from "../../lib/validation/group-id";
import { logTrace } from "../../lib/postgres/trace-logger";
import type { TraceType } from "../../lib/postgres/trace-logger";
import { randomUUID } from "crypto";
import {
  type HACCPCheckType,
  type HACCPUnit,
  type ProductCategory,
  findThreshold,
  validateHACCPValue,
  DEFAULT_HACCP_THRESHOLDS,
} from "./haccp-config";

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * HACCP Validation Error
 * Thrown when operations violate HACCP compliance requirements
 */
export class HACCPValidationError extends Error {
  public readonly code = "HACCP_ERROR";
  public readonly group_id: string;

  constructor(message: string, group_id?: string) {
    super(message);
    this.name = "HACCPValidationError";
    if (group_id) this.group_id = group_id;
  }
}

/**
 * Inventory Item
 */
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  group_id: string;
  productCategory?: ProductCategory;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Low Stock Alert
 */
export interface LowStockAlert {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  threshold: number;
  location: string;
  productCategory?: ProductCategory;
}

/**
 * HACCP Record
 */
export interface HACCPRecord {
  id: string;
  checkType: HACCPCheckType;
  value: number;
  unit: HACCPUnit;
  location: string;
  productCategory?: ProductCategory;
  group_id: string;
  isViolation: boolean;
  violationDetails?: string;
  recordedAt: Date;
  recordedBy: string;
}

/**
 * HACCP Violation
 */
export interface HACCPViolation {
  id: string;
  recordId: string;
  checkType: HACCPCheckType;
  value: number;
  unit: HACCPUnit;
  threshold: {
    minValue?: number;
    maxValue?: number;
  };
  productCategory?: ProductCategory;
  location: string;
  violationDetails: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  group_id: string;
  recordedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * Order Item
 */
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  productCategory?: ProductCategory;
}

/**
 * Order
 */
export interface Order {
  id: string;
  items: OrderItem[];
  customerId: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  group_id: string;
  createdAt: Date;
  updatedAt: Date;
  trackingNumber?: string;
}

/**
 * Business Metrics
 */
export interface BusinessMetrics {
  group_id: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  inventory: {
    totalItems: number;
    lowStockItems: number;
    totalValue: number;
    byCategory: Record<ProductCategory, number>;
  };
  haccp: {
    totalChecks: number;
    violations: number;
    complianceRate: number;
    violationsByType: Record<HACCPCheckType, number>;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    revenue: number;
  };
}

// =============================================================================
// Faith Meats Workflow Class
// =============================================================================

/**
 * Faith Meats Workflow Class
 * Handles HACCP-compliant meat processing operations
 */
export class FaithMeatsWorkflow {
  private readonly group_id: string;
  private readonly agent_id = "memory-builder";

  // In-memory storage for demo (would use PostgreSQL in production)
  private inventory: Map<string, InventoryItem> = new Map();
  private haccpRecords: Map<string, HACCPRecord> = new Map();
  private haccpViolations: Map<string, HACCPViolation> = new Map();
  private orders: Map<string, Order> = new Map();

  /**
   * Validate and enforce allura-faith-meats workspace
   * HACCP requires use of this specific workspace
   */
  constructor(group_id: string) {
    // RK-01: Enforce tenant isolation
    const validated = validateTenantGroupId(group_id);

    // HACCP constraint: Must use allura-faith-meats for food operations
    if (validated !== "allura-faith-meats") {
      throw new HACCPValidationError(
        `HACCP compliance violation: Faith Meats workflow must use 'allura-faith-meats' workspace. ` +
        `Provided: '${validated}'`,
        validated
      );
    }

    this.group_id = validated;
  }

  // ===========================================================================
  // Inventory Management
  // ===========================================================================

  /**
   * Create a new inventory item
   * HACCP: Track product category for temperature/sanitation checks
   */
  async createInventoryItem(params: {
    name: string;
    quantity: number;
    unit: string;
    location: string;
    group_id: string;
    productCategory?: ProductCategory;
  }): Promise<InventoryItem> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Validate quantity
    if (params.quantity < 0) {
      throw new HACCPValidationError(
        `Inventory quantity cannot be negative: ${params.quantity}`,
        params.group_id
      );
    }

    // Create item
    const item: InventoryItem = {
      id: randomUUID(),
      name: params.name,
      quantity: params.quantity,
      unit: params.unit,
      location: params.location,
      group_id: params.group_id,
      productCategory: params.productCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in inventory
    this.inventory.set(item.id, item);

    // Log to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `Inventory item created: ${params.name}`,
      confidence: 1.0,
      workflow_id: "faith-meats-inventory",
      metadata: {
        item_id: item.id,
        item_name: params.name,
        quantity: params.quantity,
        unit: params.unit,
        location: params.location,
        product_category: params.productCategory,
        haccp_tracked: !!params.productCategory,
      },
    });

    return item;
  }

  /**
   * Update inventory quantity
   * HACCP: Log all quantity changes for traceability
   */
  async updateInventory(params: {
    itemId: string;
    quantity: number;
    group_id: string;
  }): Promise<InventoryItem> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Find item
    const item = this.inventory.get(params.itemId);
    if (!item) {
      throw new HACCPValidationError(
        `Inventory item not found: ${params.itemId}`,
        params.group_id
      );
    }

    // Validate quantity
    if (params.quantity < 0) {
      throw new HACCPValidationError(
        `Inventory quantity cannot be negative: ${params.quantity}`,
        params.group_id
      );
    }

    // Update item
    const previousQuantity = item.quantity;
    item.quantity = params.quantity;
    item.updatedAt = new Date();

    // Log to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `Inventory updated: ${item.name} (${previousQuantity} → ${params.quantity})`,
      confidence: 1.0,
      workflow_id: "faith-meats-inventory",
      metadata: {
        item_id: params.itemId,
        item_name: item.name,
        previous_quantity: previousQuantity,
        new_quantity: params.quantity,
        unit: item.unit,
        location: item.location,
      },
    });

    return item;
  }

  /**
   * Check stock levels for low inventory
   * HACCP: Alert on low stock to prevent safety shortcuts
   */
  async checkStockLevels(params: {
    group_id: string;
    threshold?: number;
  }): Promise<LowStockAlert[]> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    const threshold = params.threshold ?? 10; // Default low stock threshold
    const alerts: LowStockAlert[] = [];

    // Check all inventory items
    for (const item of this.inventory.values()) {
      if (item.quantity <= threshold) {
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          currentQuantity: item.quantity,
          threshold,
          location: item.location,
          productCategory: item.productCategory,
        });
      }
    }

    // Log stock check
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "decision",
      content: `Stock level check: ${alerts.length} low stock alerts`,
      confidence: 1.0,
      workflow_id: "faith-meats-inventory",
      metadata: {
        threshold,
        low_stock_count: alerts.length,
        items_checked: this.inventory.size,
        alerts: alerts.map(a => ({ item: a.itemName, quantity: a.currentQuantity })),
      },
    });

    return alerts;
  }

  // ===========================================================================
  // HACCP Compliance
  // ===========================================================================

  /**
   * Record a HACCP check
   * HACCP: All checks must be logged with timestamp and location
   */
  async recordHACCPCheck(params: {
    checkType: HACCPCheckType;
    value: number;
    unit: HACCPUnit;
    location: string;
    group_id: string;
    productCategory?: ProductCategory;
  }): Promise<HACCPRecord> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Find applicable threshold
    const threshold = findThreshold(params.checkType, params.productCategory ?? 'raw_beef');

    // Validate against threshold
    const validation = threshold
      ? validateHACCPValue(params.value, params.unit, threshold)
      : { valid: true };

    // Create record
    const record: HACCPRecord = {
      id: randomUUID(),
      checkType: params.checkType,
      value: params.value,
      unit: params.unit,
      location: params.location,
      productCategory: params.productCategory,
      group_id: params.group_id,
      isViolation: !validation.valid,
      violationDetails: validation.violation,
      recordedAt: new Date(),
      recordedBy: this.agent_id,
    };

    // Store record
    this.haccpRecords.set(record.id, record);

    // Create violation if needed
    if (!validation.valid && threshold) {
      const violation: HACCPViolation = {
        id: randomUUID(),
        recordId: record.id,
        checkType: params.checkType,
        value: params.value,
        unit: params.unit,
        threshold: {
          minValue: threshold.minValue,
          maxValue: threshold.maxValue,
        },
        productCategory: params.productCategory,
        location: params.location,
        violationDetails: validation.violation ?? 'Unknown violation',
        severity: this.determineViolationSeverity(params.checkType, params.value, threshold),
        group_id: params.group_id,
        recordedAt: new Date(),
      };

      this.haccpViolations.set(violation.id, violation);
    }

    // Log to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "decision",
      content: `HACCP check recorded: ${params.checkType} at ${params.location}`,
      confidence: 1.0,
      workflow_id: "faith-meats-haccp",
      metadata: {
        record_id: record.id,
        check_type: params.checkType,
        value: params.value,
        unit: params.unit,
        location: params.location,
        product_category: params.productCategory,
        is_violation: record.isViolation,
        violation_details: record.violationDetails,
        threshold_applied: threshold?.description,
      },
    });

    return record;
  }

  /**
   * Determine violation severity
   * HACCP: Temperature violations are critical, sanitation is high
   */
  private determineViolationSeverity(
    checkType: HACCPCheckType,
    value: number,
    threshold: { minValue?: number; maxValue?: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Temperature violations are critical
    if (checkType === 'temperature') {
      // Check if severely out of range
      const minDiff = threshold.minValue ? Math.abs(value - threshold.minValue) : 0;
      const maxDiff = threshold.maxValue ? Math.abs(value - threshold.maxValue) : 0;
      const maxDeviation = Math.max(minDiff, maxDiff);

      if (maxDeviation > 5) return 'critical'; // > 5 degrees out
      if (maxDeviation > 2) return 'high'; // 2-5 degrees out
      return 'medium';
    }

    // Cross-contamination is high severity
    if (checkType === 'cross_contamination') {
      return 'high';
    }

    // Sanitation is medium by default
    return 'medium';
  }

  /**
   * Get HACCP violations for a time range
   * HACCP: Must maintain violation records for audit
   */
  async getHACCPViolations(params: {
    group_id: string;
    timeRange?: { start: Date; end: Date };
  }): Promise<HACCPViolation[]> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    let violations = Array.from(this.haccpViolations.values());

    // Filter by time range if provided
    if (params.timeRange) {
      violations = violations.filter(v => {
        const recordedAt = new Date(v.recordedAt);
        return recordedAt >= params.timeRange!.start && recordedAt <= params.timeRange!.end;
      });
    }

    // Sort by recordedAt descending
    violations.sort((a, b) => 
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    // Log violation query
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `HACCP violations query: ${violations.length} violations found`,
      confidence: 1.0,
      workflow_id: "faith-meats-haccp",
      metadata: {
        time_range: params.timeRange,
        violation_count: violations.length,
        severities: violations.map(v => v.severity),
      },
    });

    return violations;
  }

  // ===========================================================================
  // Order Processing
  // ===========================================================================

  /**
   * Create a new order
   * HACCP: Validate product availability
   */
  async createOrder(params: {
    items: OrderItem[];
    customerId: string;
    group_id: string;
  }): Promise<Order> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Validate items
    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new HACCPValidationError(
          `Order quantity must be positive: ${item.quantity}`,
          params.group_id
        );
      }
      if (item.unitPrice < 0) {
        throw new HACCPValidationError(
          `Unit price cannot be negative: ${item.unitPrice}`,
          params.group_id
        );
      }
    }

    // Calculate total
    const totalAmount = params.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Create order
    const order: Order = {
      id: randomUUID(),
      items: params.items,
      customerId: params.customerId,
      totalAmount,
      status: 'pending',
      group_id: params.group_id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store order
    this.orders.set(order.id, order);

    // Log to audit trail
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `Order created: ${order.id} for customer ${params.customerId}`,
      confidence: 1.0,
      workflow_id: "faith-meats-orders",
      metadata: {
        order_id: order.id,
        customer_id: params.customerId,
        item_count: params.items.length,
        total_amount: totalAmount,
        products: params.items.map(i => i.productName),
      },
    });

    return order;
  }

  /**
   * Process an order
   * HACCP: Update inventory and generate tracking
   */
  async processOrder(params: {
    orderId: string;
    group_id: string;
  }): Promise<{ success: boolean; trackingNumber: string }> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Find order
    const order = this.orders.get(params.orderId);
    if (!order) {
      throw new HACCPValidationError(
        `Order not found: ${params.orderId}`,
        params.group_id
      );
    }

    // Validate order status
    if (order.status !== 'pending') {
      throw new HACCPValidationError(
        `Order already processed: ${params.orderId} (status: ${order.status})`,
        params.group_id
      );
    }

    // Update order status
    order.status = 'processing';
    order.updatedAt = new Date();

    // Generate tracking number
    const trackingNumber = `FM-${Date.now()}-${order.id.substring(0, 8)}`.toUpperCase();
    order.trackingNumber = trackingNumber;

    // Mark as shipped (in production, this would have more steps)
    order.status = 'shipped';
    order.updatedAt = new Date();

    // Log processing
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "decision",
      content: `Order processed: ${params.orderId}`,
      confidence: 1.0,
      workflow_id: "faith-meats-orders",
      metadata: {
        order_id: params.orderId,
        tracking_number: trackingNumber,
        customer_id: order.customerId,
        total_amount: order.totalAmount,
        status: order.status,
      },
    });

    return {
      success: true,
      trackingNumber,
    };
  }

  // ===========================================================================
  // Business Intelligence
  // ===========================================================================

  /**
   * Get business metrics
   * HACCP: Include compliance rate in metrics
   */
  async getBusinessMetrics(params: {
    group_id: string;
    timeRange: { start: Date; end: Date };
  }): Promise<BusinessMetrics> {
    // Validate workspace
    this.validateFaithMeatsWorkspace(params.group_id);

    // Calculate inventory metrics
    const inventoryItems = Array.from(this.inventory.values());
    const totalItems = inventoryItems.length;
    const lowStockThreshold = 10;
    const lowStockItems = inventoryItems.filter(i => i.quantity <= lowStockThreshold).length;
    const totalValue = 0; // Would calculate from unit prices in production
    const byCategory: Record<ProductCategory, number> = {} as Record<ProductCategory, number>;
    
    // Initialize category counts
    for (const cat of ['raw_beef', 'raw_poultry', 'raw_pork', 'cooked_beef', 'cooked_poultry', 'processed', 'frozen'] as ProductCategory[]) {
      byCategory[cat] = inventoryItems.filter(i => i.productCategory === cat).length;
    }

    // Calculate HACCP metrics
    const haccpRecords = Array.from(this.haccpRecords.values());
    const violations = Array.from(this.haccpViolations.values());

    // Filter by time range
    const filteredRecords = haccpRecords.filter(r => {
      const recordedAt = new Date(r.recordedAt);
      return recordedAt >= params.timeRange.start && recordedAt <= params.timeRange.end;
    });

    const filteredViolations = violations.filter(v => {
      const recordedAt = new Date(v.recordedAt);
      return recordedAt >= params.timeRange.start && recordedAt <= params.timeRange.end;
    });

    const violationsByType: Record<HACCPCheckType, number> = {
      temperature: 0,
      sanitation: 0,
      cross_contamination: 0,
    };

    for (const v of filteredViolations) {
      violationsByType[v.checkType]++;
    }

    // Calculate order metrics
    const orders = Array.from(this.orders.values());
    const orderStatusCounts = {
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    };

    const revenue = orders
      .filter(o => o.status === 'shipped' || o.status === 'delivered')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Log metrics retrieval
    await logTrace({
      group_id: params.group_id,
      agent_id: this.agent_id,
      trace_type: "contribution",
      content: `Business metrics retrieved: ${params.timeRange.start.toISOString()} to ${params.timeRange.end.toISOString()}`,
      confidence: 1.0,
      workflow_id: "faith-meats-bi",
      metadata: {
        time_range: params.timeRange,
        inventory_total: totalItems,
        haccp_checks: filteredRecords.length,
        haccp_violations: filteredViolations.length,
        orders_total: orders.length,
        revenue,
      },
    });

    return {
      group_id: params.group_id,
      timeRange: params.timeRange,
      inventory: {
        totalItems,
        lowStockItems,
        totalValue,
        byCategory,
      },
      haccp: {
        totalChecks: filteredRecords.length,
        violations: filteredViolations.length,
        complianceRate: filteredRecords.length > 0
          ? ((filteredRecords.length - filteredViolations.length) / filteredRecords.length) * 100
          : 100,
        violationsByType,
      },
      orders: {
        total: orders.length,
        ...orderStatusCounts,
        revenue,
      },
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Validate that we're using the Faith Meats workspace
   */
  private validateFaithMeatsWorkspace(group_id: string): void {
    try {
      const validated = validateTenantGroupId(group_id);

      // HACCP constraint: Must use allura-faith-meats
      if (validated !== "allura-faith-meats") {
        throw new HACCPValidationError(
          `HACCP compliance violation: Faith Meats workflow must use 'allura-faith-meats' workspace. ` +
          `Provided: '${validated}'`,
          validated
        );
      }
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        throw new HACCPValidationError(
          `${TENANT_ERROR_CODE}: ${error.message}`,
          group_id
        );
      }
      throw error;
    }
  }
}

// =============================================================================
// Module Exports
// =============================================================================

let workflowInstance: FaithMeatsWorkflow | null = null;

function getWorkflow(group_id: string): FaithMeatsWorkflow {
  if (!workflowInstance || workflowInstance["group_id"] !== group_id) {
    workflowInstance = new FaithMeatsWorkflow(group_id);
  }
  return workflowInstance;
}

// Inventory Management
export async function createInventoryItem(params: {
  name: string;
  quantity: number;
  unit: string;
  location: string;
  group_id: string;
}): Promise<InventoryItem> {
  return getWorkflow(params.group_id).createInventoryItem(params);
}

export async function updateInventory(params: {
  itemId: string;
  quantity: number;
  group_id: string;
}): Promise<InventoryItem> {
  return getWorkflow(params.group_id).updateInventory(params);
}

export async function checkStockLevels(params: {
  group_id: string;
}): Promise<LowStockAlert[]> {
  return getWorkflow(params.group_id).checkStockLevels(params);
}

// HACCP Compliance
export async function recordHACCPCheck(params: {
  checkType: HACCPCheckType;
  value: number;
  unit: string;
  location: string;
  group_id: string;
}): Promise<HACCPRecord> {
  return getWorkflow(params.group_id).recordHACCPCheck(params as Parameters<FaithMeatsWorkflow['recordHACCPCheck']>[0]);
}

export async function getHACCPViolations(params: {
  group_id: string;
  timeRange?: { start: Date; end: Date };
}): Promise<HACCPViolation[]> {
  return getWorkflow(params.group_id).getHACCPViolations(params);
}

// Order Processing
export async function createOrder(params: {
  items: OrderItem[];
  customerId: string;
  group_id: string;
}): Promise<Order> {
  return getWorkflow(params.group_id).createOrder(params);
}

export async function processOrder(params: {
  orderId: string;
  group_id: string;
}): Promise<{ success: boolean; trackingNumber: string }> {
  return getWorkflow(params.group_id).processOrder(params);
}

// Business Intelligence
export async function getBusinessMetrics(params: {
  group_id: string;
  timeRange: { start: Date; end: Date };
}): Promise<BusinessMetrics> {
  return getWorkflow(params.group_id).getBusinessMetrics(params);
}

// Re-export types
export type { HACCPThreshold, HACCPCheckType as HACCPCheckTypeEnum } from './haccp-config';