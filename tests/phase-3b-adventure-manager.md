# Phase 3B — Adventure Manager deployment and verification

## Scope
New `crew/adventures.html`, `.css`, `.js`; replacements `crew/crew-shell.js`, `crew/crew-access.html`, `oba-checkout/worker.js`.

## Deployment order
1. Confirm migration `0004` has been applied to production D1 `oba-orders` (four Adventure tables). No additional migration is required for this patch.
2. Upload GitHub patch files preserving repository-relative paths. Confirm GitHub Pages deployment.
3. Deploy `oba-checkout/worker.js` to Cloudflare Worker. Confirm Worker is bound to the same `OBA_DB` D1 database.
4. Log in as Owner, open `/crew/adventures.html` and Crew Access. The new Adventures permissions should appear.
5. Create a Draft Adventure using a unique slug, summary, schedule and location. Confirm it appears in the manager. Refresh and reopen.
6. Change schedule/location, verify persistence and audit history.
7. Publish Draft -> Upcoming, then test official draft and published update, pin, edit and withdrawal. Confirm history.
8. Test a related Adventure link and removal. Confirm the canonical relationship is persisted.
9. Test lifecycle exception reasons and invalid transitions. Recap is editable after event completion; publish recap before Past.
10. Test a Crew account with adventures.view only; editing, publishing, recap and updates must return HTTP 403. Test role grants, scoped denies, and expired assignments.
11. Regression: Crew login, Longneck Form, Reviews, Inventory, cart reservation, checkout and Square webhooks.

## Important scope limits
- No public `/events` integration in this patch. Publishing an Adventure records its lifecycle/publication state but does not itself render a new public page.
- Lifecycle is manually transitioned here; scheduled automation for midnight Event Day and T-1h Live belongs in the next backend increment.
- No check-in QR, Passport, Chips, media, Community, Bake/inventory allocation, or bulletin publication is implemented in this patch.
- No new D1 schema migration. `0004` must exist.
- No live Worker, D1, browser, or authorization tests were performed when packaging. Deployment and regression verification remain mandatory.

## Known limitations to address before public launch
- D1 mutation plus audit insertion is not wrapped in one transaction for all operations; network/DB errors can leave a persisted mutation without an audit event. Harden to transactional consistency.
- Concurrent lifecycle changes need optimistic locking to avoid a stale transition; verify under concurrent submissions.
- Crew-owned update edits are available to anyone with the respective permission; record-specific ownership policy may be refined.
- Detailed event-day Crew assignments and automatic lifecycle scheduling are not included.
