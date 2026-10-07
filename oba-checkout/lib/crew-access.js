/*
 * Phase 2 Crew authorization domain contract.
 *
 * The deployed Worker currently keeps runtime helpers in worker.js so Cloudflare's
 * existing single-entry deployment remains stable. This file documents the extraction
 * boundary for the eventual module move; do not import it until the Worker deployment
 * pipeline is confirmed to bundle modules.
 *
 * Effective access order:
 *   role default -> personal override -> manager -> record -> section -> action
 * The most specific valid scoped assignment wins. At equal specificity, deny wins.
 * Expired/revoked assignments never participate. Grant authority is evaluated
 * separately from the permission being granted.
 */
export const CREW_ACCESS_SCOPE_ORDER = Object.freeze([
  'role', 'personal', 'manager', 'record', 'section', 'action'
]);
