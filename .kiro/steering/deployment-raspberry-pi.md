---
inclusion: manual
---

# Raspberry Pi Deployment

**Pi:** 192.168.1.9 | **User:** eform-kio | **Node:** 20.x | **OS:** Debian 13

## Critical Rules

1. Remove test files before build: `find src -name "*.test.ts" -delete`
2. Set `NODE_ENV=production` in `.env`
3. Never copy `node_modules` — always `npm install` on Pi
4. Frontend served on port 3001 (not 3000) in production
5. Use relative URLs (`/api`) for network portability

## Deploy Steps

```bash
# 1. Transfer (exclude node_modules, dist, .git)
scp -r backend/ frontend/ package.json eform-kio@192.168.1.9:~/spa-kiosk/

# 2. On Pi: install, build, start
ssh eform-kio@192.168.1.9 << 'EOF'
cd ~/spa-kiosk
npm install
cd backend && find src -name "*.test.ts" -delete && npm run build
cd ../frontend && npx vite build && cp -r dist ../backend/public
cd ../backend && pm2 restart kiosk-backend
EOF
```

## Verification

```bash
pm2 status                                    # kiosk-backend | online
curl http://localhost:3001/api/kiosk/health   # {"status":"ok"}
grep NODE_ENV ~/spa-kiosk/backend/.env        # NODE_ENV=production
```

## Common Errors

| Error | Fix |
|-------|-----|
| `routeNotFound` | Set `NODE_ENV=production` |
| `Cannot find module` | `npm install` + `npm run build` |
| `EACCES` | `sudo chown -R $USER:$USER ~/spa-kiosk` |
| White screen | Check `NODE_ENV=production`, check PM2 logs |

**Last Updated:** 2026-02-11
