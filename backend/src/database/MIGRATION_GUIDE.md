# Database Migration to Turkish

This guide explains how to migrate an existing database to Turkish content.

## What Gets Updated

The migration script updates the following:

1. **Survey Templates**
   - Satisfaction survey (questions, options, title, description)
   - Discovery survey (questions, options, title, description)

2. **System Settings**
   - Google review title
   - Google review description

3. **Massage Purpose Tags**
   - Translates existing English tags to Turkish:
     - Relaxation → Rahatlama
     - Pain Relief → Ağrı Giderme
     - Detox → Detoks
     - Flexibility → Esneklik
     - Post-Sport Recovery → Spor Sonrası İyileşme

## Running the Migration

### Option 1: Using npm script (Recommended)

```bash
cd backend
npm run migrate:turkish
```

### Option 2: Direct execution

```bash
cd backend
npx tsx src/database/migrate-to-turkish.ts
```

## Before Migration

**IMPORTANT: Backup your database first!**

```bash
# Windows
copy data\kiosk.db data\kiosk.db.backup

# Linux/Mac
cp data/kiosk.db data/kiosk.db.backup
```

## After Migration

1. **Restart the backend server** to ensure all changes are loaded
2. **Clear browser cache** on the frontend
3. **Test the following**:
   - Survey templates display in Turkish
   - Google review QR page shows Turkish text
   - Massage purpose tags are in Turkish
   - Admin panel can create new massages with Turkish tags

## New Database Setup

If you're setting up a new database (not migrating), the seed script will automatically create Turkish content. No migration needed.

```bash
# Delete existing database
rm data/kiosk.db

# Restart backend - it will create a new database with Turkish content
npm run dev
```

## Rollback

If you need to rollback:

```bash
# Windows
copy data\kiosk.db.backup data\kiosk.db

# Linux/Mac
cp data/kiosk.db.backup data/kiosk.db
```

Then restart the backend server.

## Verification

After migration, verify the changes:

1. **Check survey templates**:
   ```sql
   SELECT name, title FROM survey_templates;
   ```
   Should show Turkish names and titles.

2. **Check system settings**:
   ```sql
   SELECT google_review_title, google_review_description FROM system_settings;
   ```
   Should show Turkish text.

3. **Check massage purpose tags**:
   ```sql
   SELECT id, name, purpose_tags FROM massages LIMIT 5;
   ```
   Should show Turkish purpose tags.

## Troubleshooting

### Migration fails with "database is locked"
- Stop the backend server first
- Run the migration
- Restart the backend server

### Purpose tags not updating
- Check that the massage has valid JSON in purpose_tags column
- The script will skip invalid entries and log a warning

### Survey responses still show old questions
- Survey responses are historical data and are not updated
- New responses will use the new Turkish questions

## Notes

- The migration is idempotent - you can run it multiple times safely
- Existing survey responses are not modified (historical data)
- The migration uses a transaction - if any step fails, all changes are rolled back
- Purpose tags that don't match the known English tags are left unchanged
