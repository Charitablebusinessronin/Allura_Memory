# preferences

> API documentation for `preferences` module.

## Type Definitions

### `PreferencePersistence`

How each preference should be saved.  "client-cookie"  → write cookie on the browser only. "server-cookie"  → write cookie through a Server Action. "localStorage"   → save only on the client (non-layout stuff). "none"           → no saving, resets on reload.  Layout-critical prefs (sidebar_variant / sidebar_collapsible) must stay consistent during SSR → so they can’t use localStorage. Others are flexible and can use any persistence.

---

### `PreferenceValueMap`

All available preference keys and their value types.

---

### `LayoutCriticalKey`

Layout-critical keys → these affect SSR UI (sidebar shape) so they must be accessible on the server.

---

### `NonCriticalKey`

Everything else is non-critical and can be read from the client.

---

### `LayoutCriticalPersistence`

Layout-critical cannot use "localStorage" because SSR needs the value. So remove it from allowed persistence types for those keys.

---

### `PreferencePersistenceConfig`

Final config: - layout-critical keys → restricted persistence - non-critical keys → can use any persistence

---
