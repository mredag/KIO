---
inclusion: always
priority: high
---

# Process Management for Development Servers

## Quick Reference

**Frontend**: Runs on `http://localhost:3000` (Vite dev server)
**Backend**: Runs on `http://localhost:3001` (Express API server)

## Starting Servers - Best Practice Workflow

### Step 1: Check Existing Processes
```
Use: listProcesses tool
```
This shows all background processes currently managed by Kiro.

### Step 2: Clean Up if Needed
If processes exist but servers aren't responding:
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```
Then wait 2-3 seconds: `timeout /t 3 /nobreak`

### Step 3: Start Servers
```
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")
```

### Step 4: Wait for Startup
```powershell
timeout /t 10 /nobreak
```
**Critical**: Servers need 8-10 seconds to fully initialize.

### Step 5: Verify Servers Are Ready
```
getProcessOutput(processId: <backend-id>, lines: 10)
getProcessOutput(processId: <frontend-id>, lines: 10)
```

**Backend ready when you see**:
```
Backend server running on port 3001
[INFO] Backend server started on port 3001
```

**Frontend ready when you see**:
```
VITE v5.4.21  ready in XXX ms
➜  Local:   http://localhost:3000/
```

## Common Issues

### Issue: Port Already in Use
**Symptoms**: 
```
listen EADDRINUSE: address already in use :::3001
```

**Solution**:
1. Kill all node processes: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`
2. Wait 2-3 seconds
3. Restart servers

### Issue: Connection Refused
**Symptoms**:
```
net::ERR_CONNECTION_REFUSED at http://localhost:3000
```

**Solution**:
1. Check if servers are running: `listProcesses`
2. If not running, start them
3. If running, wait longer (servers still starting up)
4. Verify with `getProcessOutput`

### Issue: Process Reused but Not Working
**Symptoms**:
```
Process started successfully! ProcessId: X, isReused: true
```
But tests fail with connection errors.

**Solution**:
1. The process might be stale
2. Stop it: `controlPwshProcess(action: "stop", processId: X)`
3. Kill all node: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`
4. Start fresh

## Efficient Server Management

### Before Running Tests
```
1. listProcesses
2. If servers running → verify with getProcessOutput
3. If servers not running → start them
4. Wait 8-10 seconds
5. Run tests
```

### After Testing
Leave servers running for faster subsequent tests. Only stop if:
- Changing server configuration
- Experiencing errors
- Finishing work session

### Stopping Servers
```
controlPwshProcess(action: "stop", processId: <id>)
```
Or kill all node processes:
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Windows-Specific Commands

### Check Port Usage
```powershell
netstat -ano | findstr :3001
netstat -ano | findstr :3000
```
Use `ignoreWarning: true` parameter when running these commands.

### Kill Specific Process by PID
```powershell
taskkill /F /PID <pid>
```

### Command Separator
Use semicolon (;) not ampersand (&) in PowerShell:
```powershell
# CORRECT
taskkill /F /PID 12345; timeout /t 2 /nobreak

# INCORRECT
taskkill /F /PID 12345 & timeout /t 2 /nobreak
```

## Timing Guidelines

| Action | Wait Time | Reason |
|--------|-----------|--------|
| After killing processes | 2-3 seconds | Allow OS to release ports |
| After starting servers | 8-10 seconds | Full initialization |
| After server error | 3-5 seconds | Error handling cleanup |
| Between retries | 5 seconds | Avoid race conditions |

## Process Lifecycle

```
1. Check existing processes (listProcesses)
   ↓
2. Clean up if needed (Stop-Process)
   ↓
3. Wait for cleanup (2-3 sec)
   ↓
4. Start servers (controlPwshProcess)
   ↓
5. Wait for startup (8-10 sec)
   ↓
6. Verify ready (getProcessOutput)
   ↓
7. Run tests
   ↓
8. Leave running for next test
```

## Best Practices

1. **Always check before starting**: Use `listProcesses` first
2. **Wait adequately**: Don't rush server startup
3. **Verify before testing**: Check `getProcessOutput` to confirm ready
4. **Clean up properly**: Kill all node processes when needed
5. **Use correct tools**: `controlPwshProcess` for managed processes
6. **Handle errors gracefully**: Follow troubleshooting steps systematically

## Quick Commands Reference

```powershell
# List managed processes
listProcesses

# Get process output
getProcessOutput(processId: X, lines: 10)

# Start backend
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")

# Start frontend
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")

# Stop process
controlPwshProcess(action: "stop", processId: X)

# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait
timeout /t 10 /nobreak

# Check ports
netstat -ano | findstr :3001
```

---

**Remember**: Proper process management ensures fast, reliable testing!
