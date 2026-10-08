# Patch 05C — Unified Adventure History UI

## Changed
- Main audit history and lifecycle status history render collapsible entries, initially closed.
- Each section provides Expand all / Collapse all; nested technical payloads remain independently collapsible.
- Human-readable audit diffs omit equivalent formatted values, such as empty description to empty description.
- Lifecycle history uses the same actor-name display as the main audit history when the API supplies the name.
- Immutable audit storage, lifecycle state transitions, and API contracts are not modified.

## Manual verification
1. Open an Adventure → Operations → History. Entries should initially be collapsed.
2. Expand one entry; confirm human-readable field changes and nested Technical details.
3. Use Expand all and Collapse all. Confirm both work, including after reopening the modal.
4. Open Operations → Lifecycle; repeat tests for Status history.
5. Confirm unchanged empty descriptions do not appear as Not set → Not set.
6. Confirm Admin Account is shown in lifecycle history **if the lifecycle endpoint includes actor_name / actor_display_name**; otherwise inspect the API and implement authorized identity enrichment separately.
7. Confirm reasons, timestamps, and historical events are preserved.
8. Regress Setup dirty-state protection and save/validation flows.
