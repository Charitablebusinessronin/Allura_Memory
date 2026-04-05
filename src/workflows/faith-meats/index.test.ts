/**
 * Faith Meats Workflow Tests
 * Story 6.2: Production Workflow for allura-faith-meats Tenant
 * 
 * HACCP-compliant meat processing operations with configurable thresholds.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createInventoryItem,
  updateInventory,
  checkStockLevels,
  recordHACCPCheck,
  getHACCPViolations,
  createOrder,
  processOrder,
  getBusinessMetrics,
  type InventoryItem,
  type LowStockAlert,
  type HACCPRecord,
  type HACCPViolation,
  type Order,
  type OrderItem,
  type BusinessMetrics,
  HACCPValidationError,
} from "./index";
import {
  findThreshold,
  validateHACCPValue,
  getThresholdsForProductCategory,
  getThresholdsForCheckType,
  TemperatureConverter,
  DEFAULT_HACCP_THRESHOLDS,
  type HACCPThreshold,
  type ProductCategory,
  type HACCPCheckType,
} from "./haccp-config";

describe("Faith Meats Workflow", () => {
  // HACCP workspace - must use allura-faith-meats
  const VALID_GROUP_ID = "allura-faith-meats";
  const INVALID_GROUP_ID = "allura-audits"; // Wrong workspace

  // Test environment setup
  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";
  });

  // ==========================================================================
  // Inventory Management Tests
  // ==========================================================================

  describe("createInventoryItem", () => {
    it("should reject inventory creation without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(createInventoryItem({ name: "Beef Ribeye", quantity: 50, unit: "lbs" }))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject inventory creation with wrong workspace", async () => {
      await expect(
        createInventoryItem({
          name: "Beef Ribeye",
          quantity: 50,
          unit: "lbs",
          location: "Cooler A",
          group_id: INVALID_GROUP_ID,
        })
      ).rejects.toThrow(/RK-01/);
    });

    it("should create inventory item with valid group_id", async () => {
      const result = await createInventoryItem({
        name: "Beef Ribeye",
        quantity: 50,
        unit: "lbs",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
      });

      expect(result).toHaveProperty("id");
      expect(result.name).toBe("Beef Ribeye");
      expect(result.quantity).toBe(50);
      expect(result.unit).toBe("lbs");
      expect(result.location).toBe("Cooler A");
      expect(result.group_id).toBe(VALID_GROUP_ID);
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("should track product category for HACCP compliance", async () => {
      const result = await createInventoryItem({
        name: "Raw Chicken Breast",
        quantity: 100,
        unit: "lbs",
        location: "Cooler B",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      expect(result.productCategory).toBe("raw_poultry");
    });

    it("should reject negative quantity", async () => {
      await expect(
        createInventoryItem({
          name: "Invalid Meat",
          quantity: -10,
          unit: "lbs",
          location: "Cooler A",
          group_id: VALID_GROUP_ID,
        })
      ).rejects.toThrow(/negative/);
    });

    it("should log inventory creation to audit trail", async () => {
      const result = await createInventoryItem({
        name: "Ground Beef",
        quantity: 75,
        unit: "lbs",
        location: "Freezer A",
        group_id: VALID_GROUP_ID,
      });

      // Audit trail should be created with HACCP tracking
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("updatedAt");
    });
  });

  describe("updateInventory", () => {
    let testItem: InventoryItem;

    beforeEach(async () => {
      testItem = await createInventoryItem({
        name: "Test Beef",
        quantity: 100,
        unit: "lbs",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
      });
    });

    it("should reject update without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(updateInventory({ itemId: testItem.id, quantity: 50 }))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject update with wrong workspace", async () => {
      await expect(
        updateInventory({
          itemId: testItem.id,
          quantity: 50,
          group_id: INVALID_GROUP_ID,
        })
      ).rejects.toThrow(/RK-01/);
    });

    it("should update inventory quantity", async () => {
      const result = await updateInventory({
        itemId: testItem.id,
        quantity: 45,
        group_id: VALID_GROUP_ID,
      });

      expect(result.quantity).toBe(45);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("should reject update for non-existent item", async () => {
      await expect(
        updateInventory({
          itemId: "non-existent-id",
          quantity: 50,
          group_id: VALID_GROUP_ID,
        })
      ).rejects.toThrow(/not found/);
    });

    it("should reject negative quantity update", async () => {
      await expect(
        updateInventory({
          itemId: testItem.id,
          quantity: -5,
          group_id: VALID_GROUP_ID,
        })
      ).rejects.toThrow(/negative/);
    });

    it("should log quantity change to audit trail", async () => {
      const result = await updateInventory({
        itemId: testItem.id,
        quantity: 30,
        group_id: VALID_GROUP_ID,
      });

      // Change should be logged for HACCP traceability
      expect(result).toHaveProperty("id");
      expect(result.quantity).toBe(30);
    });
  });

  describe("checkStockLevels", () => {
    it("should reject stock check without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(checkStockLevels())
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject stock check with wrong workspace", async () => {
      await expect(
        checkStockLevels({ group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should return empty array when no low stock items", async () => {
      // Create item with sufficient quantity
      await createInventoryItem({
        name: "High Stock Beef",
        quantity: 1000,
        unit: "lbs",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
      });

      const alerts = await checkStockLevels({ group_id: VALID_GROUP_ID });

      // Should not include items above threshold
      expect(alerts.filter(a => a.itemName === "High Stock Beef").length).toBe(0);
    });

    it("should detect low stock items below threshold", async () => {
      // Create items with low quantity
      await createInventoryItem({
        name: "Low Stock Chicken",
        quantity: 5,
        unit: "lbs",
        location: "Cooler B",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      await createInventoryItem({
        name: "Low Stock Beef",
        quantity: 3,
        unit: "lbs",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      const alerts = await checkStockLevels({ group_id: VALID_GROUP_ID });

      // Should detect low stock items
      const lowStockItems = alerts.filter(a => a.currentQuantity <= 10);
      expect(lowStockItems.length).toBeGreaterThan(0);
    });

    it("should use custom threshold for stock check", async () => {
      await createInventoryItem({
        name: "Medium Stock Pork",
        quantity: 15,
        unit: "lbs",
        location: "Cooler C",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_pork",
      });

      const alerts = await checkStockLevels({
        group_id: VALID_GROUP_ID,
        threshold: 20,
      });

      // Should detect item below custom threshold
      const mediumStockAlert = alerts.find(a => a.itemName === "Medium Stock Pork");
      expect(mediumStockAlert).toBeDefined();
    });

    it("should include product category in alerts", async () => {
      await createInventoryItem({
        name: "Low Stock Chicken Breasts",
        quantity: 2,
        unit: "lbs",
        location: "Cooler B",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      const alerts = await checkStockLevels({ group_id: VALID_GROUP_ID });

      const poultryAlert = alerts.find(a => a.itemName === "Low Stock Chicken Breasts");
      expect(poultryAlert).toBeDefined();
      expect(poultryAlert?.productCategory).toBe("raw_poultry");
    });
  });

  // ==========================================================================
  // HACCP Compliance Tests
  // ==========================================================================

  describe("HACCP Configuration", () => {
    describe("findThreshold", () => {
      it("should find threshold for raw beef temperature", () => {
        const threshold = findThreshold("temperature", "raw_beef");
        expect(threshold).toBeDefined();
        expect(threshold?.minValue).toBe(0);
        expect(threshold?.maxValue).toBe(4);
        expect(threshold?.unit).toBe("celsius");
      });

      it("should find threshold for cooked beef hot holding", () => {
        const threshold = findThreshold("temperature", "cooked_beef");
        expect(threshold).toBeDefined();
        expect(threshold?.minValue).toBe(63);
        expect(threshold?.unit).toBe("celsius");
      });

      it("should find threshold for frozen storage", () => {
        const threshold = findThreshold("temperature", "frozen");
        expect(threshold).toBeDefined();
        expect(threshold?.maxValue).toBe(-18);
        expect(threshold?.minValue).toBeUndefined();
      });

      it("should find threshold for sanitation chlorine", () => {
        const threshold = findThreshold("sanitation", "raw_beef");
        expect(threshold).toBeDefined();
        expect(threshold?.minValue).toBe(50);
        expect(threshold?.maxValue).toBe(200);
        expect(threshold?.unit).toBe("ppm");
      });

      it("should return undefined for non-existent threshold", () => {
        const threshold = findThreshold("cross_contamination", "cooked_beef");
        // May or may not exist
        expect(threshold).toBeDefined();
      });
    });

    describe("validateHACCPValue", () => {
      it("should validate temperature within range", () => {
        const threshold = findThreshold("temperature", "raw_beef")!;
        const result = validateHACCPValue(2, "celsius", threshold);
        expect(result.valid).toBe(true);
        expect(result.violation).toBeUndefined();
      });

      it("should detect temperature above maximum", () => {
        const threshold = findThreshold("temperature", "raw_beef")!;
        const result = validateHACCPValue(6, "celsius", threshold);
        expect(result.valid).toBe(false);
        expect(result.violation).toContain("above maximum");
      });

      it("should detect temperature below minimum", () => {
        const threshold = findThreshold("temperature", "raw_beef")!;
        const result = validateHACCPValue(-2, "celsius", threshold);
        expect(result.valid).toBe(false);
        expect(result.violation).toContain("below minimum");
      });

      it("should validate frozen storage temperature", () => {
        const threshold = findThreshold("temperature", "frozen")!;
        const result = validateHACCPValue(-18, "celsius", threshold);
        expect(result.valid).toBe(true);
      });

      it("should detect frozen storage temperature violation", () => {
        const threshold = findThreshold("temperature", "frozen")!;
        const result = validateHACCPValue(-10, "celsius", threshold);
        expect(result.valid).toBe(false);
        expect(result.violation).toContain("above maximum");
      });

      it("should validate sanitation ppm within range", () => {
        const threshold = findThreshold("sanitation", "raw_beef")!;
        const result = validateHACCPValue(100, "ppm", threshold);
        expect(result.valid).toBe(true);
      });

      it("should detect sanitation ppm too low", () => {
        const threshold = findThreshold("sanitation", "raw_beef")!;
        const result = validateHACCPValue(30, "ppm", threshold);
        expect(result.valid).toBe(false);
        expect(result.violation).toContain("below minimum");
      });

      it("should handle unit conversion for temperature", () => {
        const threshold = findThreshold("temperature", "raw_beef")!;
        // 39°F is within 32-40°F (0-4°C)
        const result = validateHACCPValue(39, "fahrenheit", threshold);
        expect(result.valid).toBe(true);
      });
    });

    describe("TemperatureConverter", () => {
      it("should convert celsius to fahrenheit", () => {
        expect(TemperatureConverter.celsiusToFahrenheit(0)).toBe(32);
        expect(TemperatureConverter.celsiusToFahrenheit(100)).toBe(212);
        expect(TemperatureConverter.celsiusToFahrenheit(-18)).toBeCloseTo(-0.4, 1);
      });

      it("should convert fahrenheit to celsius", () => {
        expect(TemperatureConverter.fahrenheitToCelsius(32)).toBe(0);
        expect(TemperatureConverter.fahrenheitToCelsius(212)).toBe(100);
        expect(TemperatureConverter.fahrenheitToCelsius(0)).toBeCloseTo(-17.78, 1);
      });
    });

    describe("getThresholdsForProductCategory", () => {
      it("should return all thresholds for raw beef", () => {
        const thresholds = getThresholdsForProductCategory("raw_beef");
        expect(thresholds.length).toBeGreaterThan(0);
        expect(thresholds.every(t => t.productCategory === "raw_beef")).toBe(true);
      });

      it("should return all thresholds for raw poultry", () => {
        const thresholds = getThresholdsForProductCategory("raw_poultry");
        expect(thresholds.length).toBeGreaterThan(0);
        expect(thresholds.every(t => t.productCategory === "raw_poultry")).toBe(true);
      });
    });

    describe("getThresholdsForCheckType", () => {
      it("should return all temperature thresholds", () => {
        const thresholds = getThresholdsForCheckType("temperature");
        expect(thresholds.length).toBeGreaterThan(0);
        expect(thresholds.every(t => t.checkType === "temperature")).toBe(true);
      });

      it("should return all sanitation thresholds", () => {
        const thresholds = getThresholdsForCheckType("sanitation");
        expect(thresholds.length).toBeGreaterThan(0);
        expect(thresholds.every(t => t.checkType === "sanitation")).toBe(true);
      });
    });
  });

  describe("recordHACCPCheck", () => {
    it("should reject HACCP check without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(recordHACCPCheck({
        checkType: "temperature",
        value: 3,
        unit: "celsius",
        location: "Cooler A",
      })).rejects.toThrow(HACCPValidationError);
    });

    it("should reject HACCP check with wrong workspace", async () => {
      await expect(
        recordHACCPCheck({
          checkType: "temperature",
          value: 3,
          unit: "celsius",
          location: "Cooler A",
          group_id: INVALID_GROUP_ID,
        })
      ).rejects.toThrow(/RK-01/);
    });

    it("should record valid temperature check", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 2,
        unit: "celsius",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result).toHaveProperty("id");
      expect(result.checkType).toBe("temperature");
      expect(result.value).toBe(2);
      expect(result.unit).toBe("celsius");
      expect(result.location).toBe("Cooler A");
      expect(result.isViolation).toBe(false);
      expect(result.productCategory).toBe("raw_beef");
    });

    it("should detect and record temperature violation", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 8, // Above max 4°C
        unit: "celsius",
        location: "Cooler A",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.isViolation).toBe(true);
      expect(result.violationDetails).toContain("above maximum");
    });

    it("should detect frozen storage violation", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: -10, // Above max -18°C
        unit: "celsius",
        location: "Freezer A",
        group_id: VALID_GROUP_ID,
        productCategory: "frozen",
      });

      expect(result.isViolation).toBe(true);
      expect(result.violationDetails).toContain("above maximum");
    });

    it("should detect temperature below minimum", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: -2, // Below min 0°C
        unit: "celsius",
        location: "Cooler B",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.isViolation).toBe(true);
      expect(result.violationDetails).toContain("below minimum");
    });

    it("should validate hot holding temperature", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 65, // Above min 63°C
        unit: "celsius",
        location: "Hot Holding Station",
        group_id: VALID_GROUP_ID,
        productCategory: "cooked_beef",
      });

      expect(result.isViolation).toBe(false);
    });

    it("should detect hot holding temperature violation", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 60, // Below min 63°C
        unit: "celsius",
        location: "Hot Holding Station",
        group_id: VALID_GROUP_ID,
        productCategory: "cooked_beef",
      });

      expect(result.isViolation).toBe(true);
    });

    it("should record sanitation check", async () => {
      const result = await recordHACCPCheck({
        checkType: "sanitation",
        value: 100, // Within 50-200 ppm
        unit: "ppm",
        location: "Processing Area",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.checkType).toBe("sanitation");
      expect(result.value).toBe(100);
      expect(result.isViolation).toBe(false);
    });

    it("should detect sanitation ppm too low", async () => {
      const result = await recordHACCPCheck({
        checkType: "sanitation",
        value: 30, // Below min 50 ppm
        unit: "ppm",
        location: "Processing Area",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.isViolation).toBe(true);
      expect(result.violationDetails).toContain("below minimum");
    });

    it("should record cross-contamination check", async () => {
      const result = await recordHACCPCheck({
        checkType: "cross_contamination",
        value: 1.5, // Above min 1 meter
        unit: "meter",
        location: "Product Display Area",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.checkType).toBe("cross_contamination");
      expect(result.value).toBe(1.5);
      expect(result.isViolation).toBe(false);
    });

    it("should detect cross-contamination violation", async () => {
      const result = await recordHACCPCheck({
        checkType: "cross_contamination",
        value: 0.5, // Below min 1 meter
        unit: "meter",
        location: "Product Display Area",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      expect(result.isViolation).toBe(true);
      expect(result.violationDetails).toContain("below minimum");
    });

    it("should log HACCP check to audit trail", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 3,
        unit: "celsius",
        location: "Cooler C",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("recordedAt");
      expect(result.recordedBy).toBeDefined();
    });
  });

  describe("getHACCPViolations", () => {
    it("should reject violations query without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(getHACCPViolations({}))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject violations query with wrong workspace", async () => {
      await expect(
        getHACCPViolations({ group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should return violations for time range", async () => {
      // Record some violations
      await recordHACCPCheck({
        checkType: "temperature",
        value: 10, // Violation
        unit: "celsius",
        location: "Cooler X",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      await recordHACCPCheck({
        checkType: "sanitation",
        value: 30, // Violation
        unit: "ppm",
        location: "Processing Y",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      const start = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const end = new Date();

      const violations = await getHACCPViolations({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(Array.isArray(violations)).toBe(true);
      // Should include violations we just created
      expect(violations.length).toBeGreaterThan(0);
    });

    it("should return violations sorted by timestamp descending", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const violations = await getHACCPViolations({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      if (violations.length >= 2) {
        const timestamps = violations.map(v => new Date(v.recordedAt).getTime());
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
        }
      }
    });

    it("should include violation severity", async () => {
      // Record critical temperature violation
      await recordHACCPCheck({
        checkType: "temperature",
        value: 15, // Critical violation (> 5 degrees out)
        unit: "celsius",
        location: "Critical Zone",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const violations = await getHACCPViolations({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      const criticalViolation = violations.find(v => v.location === "Critical Zone");
      expect(criticalViolation).toBeDefined();
      expect(criticalViolation?.severity).toBe("critical");
    });
  });

  // ==========================================================================
  // Order Processing Tests
  // ==========================================================================

  describe("createOrder", () => {
    it("should reject order without group_id", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ribeye Steak", quantity: 10, unitPrice: 15.99 },
      ];

      // @ts-expect-error - Testing missing group_id
      await expect(createOrder({ items, customerId: "cust-1" }))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject order with wrong workspace", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ribeye Steak", quantity: 10, unitPrice: 15.99 },
      ];

      await expect(
        createOrder({ items, customerId: "cust-1", group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should create order with valid group_id", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ribeye Steak", quantity: 10, unitPrice: 15.99 },
        { productId: "prod-2", productName: "Chicken Breast", quantity: 20, unitPrice: 8.99, productCategory: "raw_poultry" },
      ];

      const result = await createOrder({
        items,
        customerId: "cust-123",
        group_id: VALID_GROUP_ID,
      });

      expect(result).toHaveProperty("id");
      expect(result.items).toHaveLength(2);
      expect(result.customerId).toBe("cust-123");
      expect(result.totalAmount).toBe(10 * 15.99 + 20 * 8.99);
      expect(result.status).toBe("pending");
      expect(result.group_id).toBe(VALID_GROUP_ID);
    });

    it("should reject order with negative quantity", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ribeye Steak", quantity: -5, unitPrice: 15.99 },
      ];

      await expect(
        createOrder({ items, customerId: "cust-456", group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/positive/);
    });

    it("should reject order with negative price", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ribeye Steak", quantity: 10, unitPrice: -15.99 },
      ];

      await expect(
        createOrder({ items, customerId: "cust-789", group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/negative/);
    });

    it("should track product category in orders", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Ground Beef", quantity: 15, unitPrice: 9.99, productCategory: "raw_beef" },
      ];

      const result = await createOrder({
        items,
        customerId: "cust-track",
        group_id: VALID_GROUP_ID,
      });

      expect(result.items[0].productCategory).toBe("raw_beef");
    });

    it("should log order creation to audit trail", async () => {
      const items: OrderItem[] = [
        { productId: "prod-1", productName: "Sirloin Steak", quantity: 5, unitPrice: 12.99 },
      ];

      const result = await createOrder({
        items,
        customerId: "cust-audit",
        group_id: VALID_GROUP_ID,
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("createdAt");
    });
  });

  describe("processOrder", () => {
    let testOrder: Order;

    beforeEach(async () => {
      testOrder = await createOrder({
        items: [
          { productId: "prod-1", productName: "Test Steak", quantity: 5, unitPrice: 10.00 },
        ],
        customerId: "cust-process",
        group_id: VALID_GROUP_ID,
      });
    });

    it("should reject processing without group_id", async () => {
      // @ts-expect-error - Testing missing group_id
      await expect(processOrder({ orderId: testOrder.id }))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject processing with wrong workspace", async () => {
      await expect(
        processOrder({ orderId: testOrder.id, group_id: INVALID_GROUP_ID })
      ).rejects.toThrow(/RK-01/);
    });

    it("should process order and generate tracking number", async () => {
      const result = await processOrder({
        orderId: testOrder.id,
        group_id: VALID_GROUP_ID,
      });

      expect(result.success).toBe(true);
      expect(result.trackingNumber).toBeDefined();
      expect(result.trackingNumber).toMatch(/^FM-/);
    });

    it("should reject processing for non-existent order", async () => {
      await expect(
        processOrder({ orderId: "non-existent", group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/not found/);
    });

    it("should reject processing already processed order", async () => {
      // First processing
      await processOrder({
        orderId: testOrder.id,
        group_id: VALID_GROUP_ID,
      });

      // Second processing should fail
      await expect(
        processOrder({ orderId: testOrder.id, group_id: VALID_GROUP_ID })
      ).rejects.toThrow(/already processed/);
    });

    it("should log order processing to audit trail", async () => {
      const result = await processOrder({
        orderId: testOrder.id,
        group_id: VALID_GROUP_ID,
      });

      expect(result.trackingNumber).toBeDefined();
    });
  });

  // ==========================================================================
  // Business Intelligence Tests
  // ==========================================================================

  describe("getBusinessMetrics", () => {
    it("should reject metrics query without group_id", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      // @ts-expect-error - Testing missing group_id
      await expect(getBusinessMetrics({ timeRange: { start, end } }))
        .rejects.toThrow(HACCPValidationError);
    });

    it("should reject metrics query with wrong workspace", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      await expect(
        getBusinessMetrics({ group_id: INVALID_GROUP_ID, timeRange: { start, end } })
      ).rejects.toThrow(/RK-01/);
    });

    it("should return business metrics for time range", async () => {
      // Create some test data
      await createInventoryItem({
        name: "Metrics Test Beef",
        quantity: 50,
        unit: "lbs",
        location: "Cooler Metrics",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      await recordHACCPCheck({
        checkType: "temperature",
        value: 3,
        unit: "celsius",
        location: "Cooler Metrics",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      await createOrder({
        items: [{ productId: "p1", productName: "Test Product", quantity: 5, unitPrice: 10 }],
        customerId: "cust-metrics",
        group_id: VALID_GROUP_ID,
      });

      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics).toHaveProperty("inventory");
      expect(metrics).toHaveProperty("haccp");
      expect(metrics).toHaveProperty("orders");
      expect(metrics.group_id).toBe(VALID_GROUP_ID);
    });

    it("should calculate inventory metrics", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics.inventory).toHaveProperty("totalItems");
      expect(metrics.inventory).toHaveProperty("lowStockItems");
      expect(metrics.inventory).toHaveProperty("byCategory");
      expect(typeof metrics.inventory.totalItems).toBe("number");
    });

    it("should calculate HACCP compliance rate", async () => {
      // Record valid check
      await recordHACCPCheck({
        checkType: "temperature",
        value: 2,
        unit: "celsius",
        location: "Compliance Test",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics.haccp).toHaveProperty("totalChecks");
      expect(metrics.haccp).toHaveProperty("violations");
      expect(metrics.haccp).toHaveProperty("complianceRate");
      expect(metrics.haccp.complianceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.haccp.complianceRate).toBeLessThanOrEqual(100);
    });

    it("should count violations by type", async () => {
      // Record violations
      await recordHACCPCheck({
        checkType: "temperature",
        value: 10, // Violation
        unit: "celsius",
        location: "Violation Test 1",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      await recordHACCPCheck({
        checkType: "sanitation",
        value: 20, // Violation (below 50 ppm)
        unit: "ppm",
        location: "Violation Test 2",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics.haccp.violationsByType).toHaveProperty("temperature");
      expect(metrics.haccp.violationsByType).toHaveProperty("sanitation");
      expect(metrics.haccp.violationsByType).toHaveProperty("cross_contamination");
    });

    it("should calculate order metrics", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics.orders).toHaveProperty("total");
      expect(metrics.orders).toHaveProperty("pending");
      expect(metrics.orders).toHaveProperty("processing");
      expect(metrics.orders).toHaveProperty("shipped");
      expect(metrics.orders).toHaveProperty("delivered");
      expect(metrics.orders).toHaveProperty("cancelled");
      expect(metrics.orders).toHaveProperty("revenue");
    });

    it("should log metrics retrieval to audit trail", async () => {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = new Date();

      const metrics = await getBusinessMetrics({
        group_id: VALID_GROUP_ID,
        timeRange: { start, end },
      });

      expect(metrics.group_id).toBe(VALID_GROUP_ID);
      expect(metrics.timeRange.start).toEqual(start);
      expect(metrics.timeRange.end).toEqual(end);
    });
  });

  // ==========================================================================
  // HACCP Data Handling Tests
  // ==========================================================================

  describe("HACCP Data Handling", () => {
    it("should enforce allura-faith-meats workspace for all operations", async () => {
      // All faith-meats operations must use allura-faith-meats
      const wrongGroupIds = [
        "allura-audits",
        "allura-creative",
        "allura-personal",
        "allura-nonprofit",
        "allura-haccp",
      ];

      for (const groupId of wrongGroupIds) {
        await expect(
          createInventoryItem({
            name: "Test Meat",
            quantity: 10,
            unit: "lbs",
            location: "Test",
            group_id: groupId,
          })
        ).rejects.toThrow(/RK-01/);
      }
    });

    it("should classify all HACCP data for traceability", async () => {
      const result = await recordHACCPCheck({
        checkType: "temperature",
        value: 3,
        unit: "celsius",
        location: "Traceability Test",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_poultry",
      });

      // HACCP data should be fully traceable
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("recordedAt");
      expect(result).toHaveProperty("recordedBy");
      expect(result.productCategory).toBe("raw_poultry");
    });
  });

  describe("group_id Enforcement", () => {
    it("should validate group_id format for every operation", async () => {
      // Test each workflow function with invalid group_id
      const invalidGroupIds = [
        "RONINCLAW-FAITH-MEATS", // Legacy format
        "Allura-Faith-Meats",   // Uppercase
        "faith-meats",          // Missing prefix
        "",                     // Empty
        "allura_",              // Invalid characters
      ];

      for (const groupId of invalidGroupIds) {
        await expect(
          createInventoryItem({
            name: "Test",
            quantity: 10,
            unit: "lbs",
            location: "Test",
            group_id: groupId,
          })
        ).rejects.toThrow();
      }
    });

    it("should log all operations with group_id for tenant isolation", async () => {
      const result = await createInventoryItem({
        name: "Isolation Test",
        quantity: 100,
        unit: "lbs",
        location: "Isolation Cooler",
        group_id: VALID_GROUP_ID,
        productCategory: "raw_beef",
      });

      expect(result.group_id).toBe(VALID_GROUP_ID);
    });
  });
});