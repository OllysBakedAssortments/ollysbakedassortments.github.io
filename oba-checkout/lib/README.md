# Worker Domain Modules

`oba-checkout/worker.js` remains the stable Worker entrypoint. New backend domains should be extracted here incrementally as they are implemented rather than rewriting the Worker wholesale.

Planned domains include authorization/access, audit, Adventures, attendance/check-in, rewards, media, community, posts/interactives and Bulletin.

Extraction rule: move a domain only when its behavior is covered by the relevant regression/security checks. Do not create duplicate implementations in both the entrypoint and a module.
