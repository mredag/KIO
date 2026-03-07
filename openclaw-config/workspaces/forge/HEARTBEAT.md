# HEARTBEAT — Forge

Heartbeat is currently disabled (`target: "none"` in gateway config).

If heartbeat is re-enabled in the future:
- No pending tasks → respond `HEARTBEAT_OK`
- Active work in progress → brief status update (1 line)
- Blocked on something → report the blocker

Do NOT use heartbeat to start unsolicited work. Wait for explicit task delegation.
