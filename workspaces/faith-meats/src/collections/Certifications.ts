import type { CollectionConfig } from "payload";

export const Certifications: CollectionConfig = {
  slug: "certifications",
  admin: {
    useAsTitle: "name",
    group: "Compliance",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Certification Name",
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "HACCP", value: "haccp" },
        { label: "USDA", value: "usda" },
        { label: "Organic", value: "organic" },
        { label: "Gluten-Free", value: "gluten-free" },
        { label: "Kosher", value: "kosher" },
        { label: "Halal", value: "halal" },
        { label: "Non-GMO", value: "non-gmo" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "certifyingBody",
      type: "text",
      required: true,
      label: "Certifying Body",
    },
    {
      name: "certificateNumber",
      type: "text",
      label: "Certificate Number",
    },
    {
      name: "issuedAt",
      type: "date",
      required: true,
      label: "Issue Date",
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      label: "Expiration Date",
    },
    {
      name: "document",
      type: "upload",
      relationTo: "media",
      label: "Certificate Document",
    },
    {
      name: "status",
      type: "select",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Expired", value: "expired" },
        { label: "Revoked", value: "revoked" },
        { label: "Pending Renewal", value: "pending-renewal" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "notes",
      type: "textarea",
      label: "Internal Notes",
    },
  ],
  timestamps: true,
};
