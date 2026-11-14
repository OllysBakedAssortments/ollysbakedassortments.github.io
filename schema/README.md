# Phase 03D.4J schema
No SQL changes or migrations. The endpoint uses existing `checkout_attempts`, `cart_reservations`, and the `crew_security_events` audit table. Its unique `event_id` allows exactly one immutable final-resolution entry per checkout attempt.
