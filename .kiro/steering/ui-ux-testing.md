---
inclusion: fileMatch
fileMatchPattern: "frontend/src/**"
---

# UI/UX Testing with Puppeteer

**Frontend:** http://localhost:3000 | **Backend:** http://localhost:3001
**Test script:** `node test-my-app-now.js`

## After Any UI Change

1. Check servers running (`listProcesses`)
2. If not running, start them and wait 8-10s
3. Run `node test-my-app-now.js`
4. Verify screenshots

## Server Management

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
# Wait 3s, then start:
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")
# Wait 8-10s before testing
```

## Common Errors

| Error | Fix |
|-------|-----|
| `net::ERR_CONNECTION_REFUSED` | Start servers, wait 8-10s |
| `page.waitForTimeout is not a function` | Use `await new Promise(r => setTimeout(r, ms))` |
| `EADDRINUSE :::3001` | Kill all node processes first |

## Kiosk Requirements
- Touch targets: min 80x80px
- Fonts: 24px+ for kiosk, 16px+ for admin
- Color contrast: 4.5:1 minimum
- Test viewports: mobile (375x667), tablet (768x1024), desktop (1920x1080)

**Last Updated:** 2026-02-11
