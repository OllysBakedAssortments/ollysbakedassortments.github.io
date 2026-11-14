# OBA Phase 03D.4A — Square payment-readiness guard

Only changed files are included. This is a safety-focused installment, **not** live Square activation or a completed end-to-end payment test.

## Deployment order

1. Keep `ENABLE_GIRAFFE_PACK_CHECKOUT` disabled in the main `oba-checkout` Worker.
2. Back up currently deployed Worker code and compare/merge any changes newer than the uploaded repository.
3. Deploy `oba-checkout/worker.js` with existing D1 and Square bindings.
4. Visit `https://oba-checkout.ollysbakedassortments.workers.dev/storefront/payment-readiness`. It should report `ok:true`, `environment:"sandbox"`, `ready:true` only when sandbox token and location ID are configured. This does not test that Square credentials are valid.
5. Only after that, replace `order.html` on GitHub and verify the sandbox card form initializes. If the Worker has not been deployed, the new frontend intentionally blocks card initialization.

## Changes

- New `GET /storefront/payment-readiness` returns non-secret sandbox readiness, reason, and pack flag status, with `Cache-Control: no-store` and the existing origin policy.
- `/checkout` now fails with HTTP 503 before parsing a payment request if sandbox access token or location ID is missing, or `SQUARE_ENVIRONMENT` is set to a non-sandbox value.
- Browser checks readiness **before** loading the Sandbox Square Web Payments SDK.
- Default remains sandbox if `SQUARE_ENVIRONMENT` is unspecified; no production credentials, payment APIs, or live-activation behavior were introduced.

## Caution

- A configured token is not proof it is valid; verify with existing `/square-test` (be mindful that route returns Square errors).
- This code does not reconcile payment callbacks, expire reservations, perform live payment tests, or switch to Square production. A real Square launch requires coordinated production SDK IDs, Worker endpoint and token configuration, webhook verification, and transaction testing.
- No SQL migration required.
