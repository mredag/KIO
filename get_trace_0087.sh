sqlite3 ~/kio-new/data/kiosk.db "SELECT ai_response, pipeline_trace, pipeline_error FROM instagram_interactions WHERE execution_id = 'EXE-0087a897';" > trace_0087.json
cat trace_0087.json
