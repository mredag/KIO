const { execSync } = require('child_process');
const fs = require('fs');
const out = execSync("ssh eform-kio@192.168.1.8 \"curl -s http://localhost:3001/api/mc/dm-kontrol/execution/EXE-0087a897\"");
fs.writeFileSync("trace_proper.json", out);
