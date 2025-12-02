#!/usr/bin/env node
/**
 * Capture console logs from the kiosk browser via Chrome DevTools Protocol
 * Run on Pi: node scripts/capture-kiosk-console.js
 */

const WebSocket = require('ws');
const http = require('http');

async function getDebuggerUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(data);
          const kioskPage = pages.find(p => p.type === 'page' && p.url.includes('localhost:3001'));
          if (kioskPage) {
            resolve(kioskPage.webSocketDebuggerUrl);
          } else {
            reject(new Error('Kiosk page not found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function captureConsoleLogs() {
  console.log('Connecting to kiosk browser...');
  
  const wsUrl = await getDebuggerUrl();
  console.log('WebSocket URL:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  let messageId = 1;
  
  ws.on('open', () => {
    console.log('Connected! Enabling console logging...');
    
    // Enable Runtime domain to receive console messages
    ws.send(JSON.stringify({ id: messageId++, method: 'Runtime.enable' }));
    
    // Enable Log domain
    ws.send(JSON.stringify({ id: messageId++, method: 'Log.enable' }));
    
    console.log('\n--- Listening for console messages (Ctrl+C to stop) ---\n');
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      // Handle console.log messages
      if (msg.method === 'Runtime.consoleAPICalled') {
        const { type, args, timestamp } = msg.params;
        const time = new Date(timestamp).toISOString();
        const values = args.map(arg => {
          if (arg.type === 'string') return arg.value;
          if (arg.type === 'object' && arg.preview) {
            return JSON.stringify(
              arg.preview.properties.reduce((obj, p) => {
                obj[p.name] = p.value;
                return obj;
              }, {}),
              null, 2
            );
          }
          return arg.value || arg.description || JSON.stringify(arg);
        }).join(' ');
        
        console.log(`[${time}] [${type.toUpperCase()}] ${values}`);
      }
      
      // Handle Log.entryAdded
      if (msg.method === 'Log.entryAdded') {
        const { entry } = msg.params;
        console.log(`[LOG] [${entry.level}] ${entry.text}`);
      }
      
      // Handle errors
      if (msg.method === 'Runtime.exceptionThrown') {
        const { exceptionDetails } = msg.params;
        console.error('[EXCEPTION]', exceptionDetails.text, exceptionDetails.exception?.description);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
  
  ws.on('close', () => {
    console.log('Connection closed');
  });
  
  // Keep running
  process.on('SIGINT', () => {
    console.log('\nClosing connection...');
    ws.close();
    process.exit(0);
  });
}

captureConsoleLogs().catch(console.error);
