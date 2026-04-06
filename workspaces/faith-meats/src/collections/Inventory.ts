import type { CollectionConfig } from "payload";

export const Inventory: CollectionConfig = {
  slug: "inventory",
  admin: {
    useAsTitle: "batchCode",
    group: "Operations",
    defaultColumns: ["batchCode", "product", "quantity", "status", "expiresAt"],
  },
  fields: [
    {
      name: "batchCode",
      type: "text",
      required: true,
      unique: true,
      label: "Batch Code",
      admin: {
        description: "Unique identifier for HACCP traceability",
      },
    },
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      required: true,
      label: "Product",
    },
    {
      name: "flavor",
      type: "relationship",
      relationTo: "flavors",
      label: "Flavor",
    },
    {
      name: "quantity",
      type: "group",
      label: "Quantity",
      fields: [
        { name: "units", type: "number", required: true, min: 0 },
        {
          name: "unit",
          type: "select",
          defaultValue: "cases",
          options: [
            { label: "Cases", value: "cases" },
            { label: "Bags", value: "bags" },
            { label: "Lbs", value: "lbs" },
          ],
        },
      ],
    },
    {
      name: "location",
      type: "select",
      required: true,
      options: [
        { label: "Cold Storage A", value: "cold-a" },
        { label: "Cold Storage B", value: "cold-b" },
        { label: "Dry Storage", value: "dry" },
        { label: "Shipping Hold", value: "shipping-hold" },
        { label: "Quarantine", value: "quarantine" },
      ],
    },
    {
      name: "manufacturedAt",
      type: "date",
      required: true,
      label: "Manufacture Date",
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      label: "Expiration Date",
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "available",
      options: [
        { label: "Available", value: "available" },
        { label: "Reserved", value: "reserved" },
        { label: "Shipped", value: "shipped" },
        { label: "Quarantine", value: "quarantine" },
        { label: "Recalled", value: "recalled" },
        { label: "Destroyed", value: "destroyed" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "haccpLogs",
      type: "relationship",
      relationTo: "haccp-logs",
      hasMany: true,
      label: "HACCP Logs",
      admin: {
        description: "All HACCP records tied to this batch",
      },
    },
    {
      name: "supplier",
      type: "group",
      label: "Raw Material Source",
      fields: [
        { name: "name", type: "text", label: "Supplier Name" },
        { name: "lotNumber", type: "text", label: "Supplier Lot #" },
        { name: "receivedAt", type: "date", label: "Date Received" },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      label: "Notes",
    },
  ],
  timestamps: true,
};
