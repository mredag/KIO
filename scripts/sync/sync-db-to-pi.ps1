Write-Error @"
This script is deprecated and intentionally blocked.

Do not copy a local SQLite database over the live Pi database.
Use one of these instead:
  1. deployment/raspberry-pi/update-pi.sh for code deploys
  2. deployment/raspberry-pi/backup-database.sh and restore-backup.sh for controlled DB recovery
  3. admin UI or change-set APIs for live business-data edits
"@
exit 1