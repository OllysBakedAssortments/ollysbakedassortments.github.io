# OBA Phase 03B.2 — Mixed Pack Acceptance Runner

## Purpose

Extend the already deployed staging-only Giraffe Pack reservation test to allow up to three distinct flavors and a one-click read-only inventory before/after verification for hold and release.

## Files changed

- `oba-checkout/staging/worker.js` only.
- `schema/README.md` documents the absence of migrations.

## Security scope

The route remains staging-host-only, same-origin POST, authenticated as Crew with `products.manage` permission. Existing Patch 1B allowlist is preserved. There are **no production or GitHub files** to deploy. No changes to Square or customer checkout.

## Deployment

1. Open Cloudflare Workers & Pages → `oba-checkout-staging`, **not** `oba-checkout`.
2. Preserve active staging Worker as rollback; merge any newer changes since the source package `OBA-Phase03B-staging-route-guard-fix.zip`.
3. Replace staging `worker.js` and deploy.
4. Sign in via `/__patch1b`, then open `/__giraffe-pack-test`.

## Acceptance

1. `stage-00c-test`, `lil`, `plain-jane` x3: with only 1 Online available, expect HTTP 409; inspect before/after should match.
2. For successful hold+release, **prepare sufficient synthetic Online stock on staging** through approved staging inventory controls; never modify production or pretend baked cookies exist. Then click `Hold → verify → release → verify`. `passed:true` requires availability decrease by each quantity and full restoration.
3. Mixed-flavor case: prepare a second staging catalog item with valid classification, active inventory item and actual synthetic Online allocation; select two flavors whose quantities total 3. Test successful lifecycle, then deliberately reduce availability of one flavor and verify a 409 with unchanged stock.
4. Test expired holds and overlapping/cart contention separately; this page does not prove concurrent race safety or the Square checkout lifecycle.

## Known limits

- Pack prices are **provisional**; classification and individual prices are not fully approved.
- The inspection endpoint reports unexpired holds; it does **not** update stale `active` status fields.
- A stock inspection immediately after a release can include other concurrent staging holds; for deterministic tests use an isolated staging drop.
- The test form supports three flavors; the reservation API itself supports up to 13 flavors.
- No automated fixture-creation or stock-adjustment endpoint is included. That separation avoids creating stock through an acceptance route.
