sqlite3 ~/kio-new/data/kiosk.db "SELECT pipeline_trace FROM instagram_interactions WHERE execution_id = 'EXE-62909084';" > trace.json
cat trace.json
