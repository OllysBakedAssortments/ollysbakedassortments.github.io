OBA 00D.2 + 00C staging route merged

Only file to deploy: oba-checkout/staging/worker.js
This retains the 00D.2 conditional Crew stock deduction changes and restores the 00C GET /inventory staging exception.
No database migration is included or needed: the 00D.2 trigger is already installed in staging.
Deploy ONLY to oba-checkout-staging, bound to oba-orders-staging. Do NOT replace production.
Verify https://oba-checkout-staging.ollysbakedassortments.workers.dev/inventory returns ok:true and staging Plain Jane online available from the current holds.
NOTE: Patch 1B still blocks the Crew transfer and adjustment endpoints. This patch is only a read-only inventory API smoke-test fix; Crew HTTP integration testing needs a separate narrowly scoped route/test authorization plan. The GET inventory handler can update expired hold statuses.
