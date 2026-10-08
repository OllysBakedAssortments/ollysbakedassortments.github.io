# Phase 4B verification (NOT YET RUN IN PRODUCTION)

1. Deploy new/modified GitHub files and replace full Worker source. No new D1 migration.
2. Sign in as authorized Crew, open an Adventure in Live state, open its check-in station.
3. Generate a rotating credential, open its scan link, sign in as Longneck, confirm once. Check D1 `adventure_attendance`, Passport and Crew count.
4. Repeat check-in: expect alreadyCheckedIn, no second row.
5. Issue assisted credential and check in a DIFFERENT Longneck; confirm second use fails for a different Longneck.
6. Pause: existing token must be rejected. Resume: new credential should work. Rotate: old token rejected. End: all tokens rejected and issuance blocked.
7. Check expiry after 30/60 minutes, authorization for view-only Crew, and audit rows.
8. Regression: checkout, Square, inventory, Longneck sign-in, Adventure lifecycle and Reviews.

LIMITATIONS: Crew station currently provides a secure link rather than a rendered QR graphic; a local QR renderer is needed before physical QR display. Hourly expiry is enforced but automatic generation of the next QR is not yet implemented. Sign-in continuation requires reopening the link after authentication. This patch must not be considered a complete production QR launch.
