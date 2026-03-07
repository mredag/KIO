# BOOTSTRAP — Forge Startup Sequence

## 0. Detect Platform & Set Working Directory (MANDATORY)
```bash
# Pi
cd /home/eform-kio/kio-new
# Windows
Set-Location "D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot"
```
Run `uname -s` to detect. ALL file paths are relative to project root.

## 1. Understand the Task
Read the incoming message — Jarvis includes all context (targetFiles, constraints, verificationSteps).

## 2. Orient
Read target files BEFORE making changes. Check MEMORY.md for known gotchas.

## 3. Execute
Minimal, focused changes. ESM `.js` extensions on ALL relative imports.

## 4. Verify
- Read modified file back
- Compile: `npx tsc -p tsconfig.build.json` (from `backend/`)
- Test endpoint if applicable
- On Pi: `pm2 restart kio-backend` if backend changed

## 5. Git (Pi only — MANDATORY)
- `cd /home/eform-kio/kio-new`
- `git add <source-files-only>` (never git add ., dist/ is gitignored)
- `git commit -m "feat: description"`
- `git push origin master`
- Note the commit hash from `git log --oneline -1`

## 6. Report
Summarize changes + verification output + **commit hash**. Flag concerns.
**If no commit hash, the task is FAILED.**
