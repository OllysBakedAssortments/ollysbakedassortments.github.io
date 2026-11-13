# OBA Phase 02E — Weekly stock controls polish

**Scope:** UI-only GitHub Pages update.

- Baked stock defaults to the Kitchen location when available.
- Transfer controls default to distinct locations when at least two exist.
- Same-location transfers are disabled in the UI, with visible feedback.
- Bake quantity and transfer quantity are independent.
- Bake and transfer controls are laid out in separate responsive groups.
- Existing Worker endpoints, authorization checks, and stock ledger protections remain unchanged.

**Deploy:** Update `crew/products.html` in GitHub; no Worker deployment and no SQL migration required.

**Verify:** Open Products > Weekly Drops > saved drop > Inventory connection. Check defaults and disabled same-location transfer. Do not create fake stock in production.
