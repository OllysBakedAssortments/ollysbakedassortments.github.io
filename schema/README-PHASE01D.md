# Crew Commerce Hub — Phase 01D (frontend scaffold)

Updated files only:
- `crew/crew-shell.js`: Operations navigation uses Orders rather than Pickups, removes stand-alone Drops. Longnecks section unchanged.
- `crew/products.html`: native Products tabbed hub.
- `crew/orders.html`: Orders workspace shell with All Orders, Pickup Queue, Fulfillment, Exceptions.
- `crew/analytics.html`: Analytics reporting workspace shell.

No Worker/database changes. No inventory/order/payment write APIs are called. Existing production Crew session gate is reused.

**Important:** `crew-auth.js` currently validates sessions against production `https://api.ollysbakedassortments.com`, while Phase 01C catalog resides on staging Worker. Product editing deliberately stays on its existing staging-origin secured editor links. A staging-authenticated bridge or safe API routing is required before catalog editing can occur natively inside `/crew/products.html`. This ZIP should be previewed on a safe staging branch/site before production deployment. These pages are honest foundations, not complete operational modules.

Paths to deploy from the repository root, preserving directories.
