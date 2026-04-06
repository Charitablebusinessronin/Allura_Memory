import type { CollectionConfig } from "payload";

export const Flavors: CollectionConfig = {
  slug: "flavors",
  admin: {
    useAsTitle: "name",
    group: "Catalog",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Flavor Name",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "description",
      type: "textarea",
      label: "Flavor Description",
    },
    {
      name: "heatLevel",
      type: "select",
      label: "Heat Level",
      options: [
        { label: "None", value: "none" },
        { label: "Mild", value: "mild" },
        { label: "Medium", value: "medium" },
        { label: "Hot", value: "hot" },
        { label: "Extra Hot", value: "extra-hot" },
      ],
    },
    {
      name: "flavorProfile",
      type: "select",
      hasMany: true,
      label: "Flavor Profile Tags",
      options: [
        { label: "Sweet", value: "sweet" },
        { label: "Smoky", value: "smoky" },
        { label: "Savory", value: "savory" },
        { label: "Tangy", value: "tangy" },
        { label: "Teriyaki", value: "teriyaki" },
        { label: "Pepper", value: "pepper" },
        { label: "BBQ", value: "bbq" },
        { label: "Garlic", value: "garlic" },
      ],
    },
    {
      name: "seasoningCode",
      type: "text",
      label: "Internal Seasoning Code",
      admin: {
        description: "Used for HACCP batch tracking and supplier reference",
      },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      label: "Active",
      admin: { position: "sidebar" },
    },
  ],
  timestamps: true,
};
