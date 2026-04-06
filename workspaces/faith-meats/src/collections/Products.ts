import type { CollectionConfig } from "payload";

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    useAsTitle: "name",
    group: "Catalog",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Product Name",
    },
    {
      name: "sku",
      type: "text",
      required: true,
      unique: true,
      label: "SKU",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { position: "sidebar" },
    },
    {
      name: "description",
      type: "richText",
      label: "Description",
    },
    {
      name: "flavors",
      type: "relationship",
      relationTo: "flavors",
      hasMany: true,
      label: "Available Flavors",
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: "Beef Jerky", value: "beef-jerky" },
        { label: "Meat Sticks", value: "meat-sticks" },
        { label: "Biltong", value: "biltong" },
        { label: "Snack Mix", value: "snack-mix" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "weight",
      type: "group",
      label: "Weight",
      fields: [
        { name: "value", type: "number", required: true },
        {
          name: "unit",
          type: "select",
          defaultValue: "oz",
          options: [
            { label: "oz", value: "oz" },
            { label: "lb", value: "lb" },
            { label: "g", value: "g" },
          ],
        },
      ],
    },
    {
      name: "price",
      type: "number",
      required: true,
      min: 0,
      label: "Price (USD)",
    },
    {
      name: "certifications",
      type: "relationship",
      relationTo: "certifications",
      hasMany: true,
      label: "Certifications",
    },
    {
      name: "haccpCompliant",
      type: "checkbox",
      defaultValue: true,
      label: "HACCP Compliant",
      admin: { position: "sidebar" },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Discontinued", value: "discontinued" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "images",
      type: "array",
      label: "Product Images",
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
        { name: "alt", type: "text" },
      ],
    },
    {
      name: "ingredients",
      type: "textarea",
      label: "Ingredients List",
    },
    {
      name: "allergens",
      type: "select",
      hasMany: true,
      options: [
        { label: "Soy", value: "soy" },
        { label: "Wheat/Gluten", value: "wheat" },
        { label: "Milk", value: "milk" },
        { label: "Tree Nuts", value: "tree-nuts" },
        { label: "Peanuts", value: "peanuts" },
      ],
      label: "Allergen Declarations",
    },
    {
      name: "nutritionFacts",
      type: "group",
      label: "Nutrition Facts (per serving)",
      fields: [
        { name: "servingSize", type: "text" },
        { name: "calories", type: "number" },
        { name: "totalFat", type: "number", label: "Total Fat (g)" },
        { name: "sodium", type: "number", label: "Sodium (mg)" },
        { name: "totalCarbs", type: "number", label: "Total Carbs (g)" },
        { name: "protein", type: "number", label: "Protein (g)" },
      ],
    },
  ],
  timestamps: true,
};
