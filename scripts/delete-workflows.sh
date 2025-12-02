#!/bin/bash
# Delete all workflows except WhatsApp Kupon Ultimate v1
sqlite3 ~/.n8n/database.sqlite "DELETE FROM workflow_entity WHERE id != 'ioCqeu9rcz8foAzp';"
echo "Deleted workflows. Remaining:"
sqlite3 ~/.n8n/database.sqlite "SELECT id, name FROM workflow_entity;"
