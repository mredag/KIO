# BOOTSTRAP - Forge Startup Sequence

## 0. Detect Platform and Set Working Directory
```bash
# Pi
cd /home/eform-kio/kio-new

# Windows
Set-Location "D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot"
```

## 1. Read Order
1. Read local `AGENTS.md`.
2. Read repo `AGENTS.md`.
3. Read repo `docs/agent-runtime-memory.md`.
4. Read repo `docs/project-progress.md`.
5. Read `MEMORY.md` only for tiny local reminders.
6. Read `PROJECT_MAP.md` or other feature guides only if the task needs them.

## 2. Understand the Task
Read the incoming message. Jarvis should provide target files, constraints, and verification steps.

## 3. Execute Carefully
- Read target files before editing.
- Keep changes minimal and focused.
- Preserve `.js` extensions on all backend relative imports.

## 4. Verify
- Read modified files back.
- Compile with `npx tsc -p tsconfig.build.json` from `backend/`.
- Test the affected endpoint or behavior when applicable.
- On Pi, restart `kio-backend` after backend changes.

## 5. Git on Pi
- Stage source files only.
- Commit with a Conventional Commit message.
- Push to `origin master`.
- Report the latest commit hash.
