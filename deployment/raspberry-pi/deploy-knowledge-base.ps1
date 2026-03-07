# Deprecated KB deployment helper.
# Live knowledge base edits must not reseed or overwrite the live DB.

Write-Error @"
This script is deprecated and intentionally blocked.

Do not deploy live KB changes by copying seed files or reseeding the database.
Use one of these instead:
  1. Admin UI: http://192.168.1.8:3001/admin/knowledge-base
  2. Agent KB change-set workflow: preview -> approval -> apply

Reason:
  Seed/migration based KB deploys can overwrite live admin-managed knowledge.
"@
exit 1
