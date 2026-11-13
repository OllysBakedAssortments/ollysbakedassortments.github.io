# Phase 03B — Patch 1B route gate repair

## Root cause

The Phase 03B staging Worker served `/__giraffe-pack-test`, but its earlier Patch 1B allowlist did not include the test page's POST target `/__giraffe-pack-reservation`. As a result, requests returned HTTP 404 (`Endpoint disabled in Patch 1B staging`) before reaching the handler.

## Exact code change

Added `/__giraffe-pack-reservation` to the existing `allowedPaths` Set. No other routes were opened. The handler retains same-origin, staging-host, Crew authentication and `products.manage` authorization requirements, and its original inventory constraints.

## Deployment (staging only)

1. Go to Cloudflare Workers & Pages > `oba-checkout-staging` > Edit code.
2. Preserve current deployed version as rollback; reconcile this change with any subsequent staging edits.
3. Replace staging Worker with `oba-checkout/staging/worker.js` (or add only the one allowlist entry to the currently running version), and deploy **staging only**.
4. Sign in via `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__patch1b`.
5. Open `https://oba-checkout-staging.ollysbakedassortments.workers.dev/__giraffe-pack-test` and run the Lil / Plain Jane quantity 3 test.

Expected for insufficient inventory: HTTP 409 with a stock-conflict message. HTTP 401 requires staging Crew login; HTTP 403 indicates origin or authorization failure. HTTP 404 with `Endpoint disabled in Patch 1B staging` means the allowlist fix is not live.

No SQL migration. No production Worker or GitHub page deployment.
