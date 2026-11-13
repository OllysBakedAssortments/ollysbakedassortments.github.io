# OBA Cookies — Phase 03D.2A: atomic Giraffe Pack reservations (main Worker)

## Delivered

- New `POST /storefront/giraffe-packs/cart-hold` endpoint, reusing the exact validated composition, pricing, drop and availability checks of `/storefront/giraffe-packs/cart-plan`.
- In one D1 batch, inserts a standard `cart_reservations` header, all aggregated `cart_reservation_items` for pack + individuals, and an immutable initial pack price/composition snapshot in `giraffe_pack_reservation_details`.
- Any trigger or metadata insert failure rejects the batch; there is no intentional partial hold.
- Rejects existing active reservations for the same cart; prevents legacy cart editing from rewriting an existing pack hold.
- Explicit guard in `/checkout` rejects pack-backed reservations BEFORE Square processing; discounted packs cannot be silently charged as individual cookies.
- Existing ordinary-cookie checkout stays unchanged once the additive schema migration is present.

## Deployment steps

1. Back up the deployed `oba-checkout` Worker and compare its version with `oba-checkout/worker.js` in this ZIP, merging any newer production changes.
2. Run `schema/phase-03d2a-pack-reservations.sql` in **Cloudflare D1 → oba-orders → Console**. This step MUST occur first.
3. Deploy the merged main `oba-checkout` Worker using existing environment bindings.
4. Verify normal-cookie ordering and reservations still work. Do not test purchases with real cards just for validation.
5. The customer-facing builder/cart remain in **preview mode** in this phase. Do not turn on Pack Checkout or expose the `cart-hold` action to customers yet.

## New endpoint request

`POST https://api.ollysbakedassortments.com/storefront/giraffe-packs/cart-hold`

Body uses the same structure as `/storefront/giraffe-packs/cart-plan`:

```json
{
  "cartId": "<valid-v4-UUID>",
  "pack": {
    "planningDropId": "<approved-ready-planning-drop-UUID-prefixed-wd->",
    "size": "lil",
    "items": [
      {"productId":"plain-jane","quantity":2},
      {"productId":"campfire-crunch","quantity":1}
    ]
  },
  "individualItems": []
}
```

The `Origin` header must be the storefront origin. Requires a ready weekly menu, active linked physical inventory drop, published/approved flavors, and actual Online stock. Returns `201` with `reservationId`, `expiresAt`, validated subtotal, `checkoutAuthorized:false` on success, or `409` on unavailable stock/existing holds.

This release does NOT enable customer pack purchases. **Next phase 03D.2B** must implement persisted pack-price verification in checkout, pack-aware Square line items/order fingerprint and payment reconciliation before the frontend can enable paying for the pack. Do not claim end-to-end checkout is tested.

## Verification

JavaScript `node --check` passes. Not deployed or live-tested. Read-only `/cart-plan` remains intact.
