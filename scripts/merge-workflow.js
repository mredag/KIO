const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('n8n-workflows/workflows-v2/whatsapp-dynamic-ai.json'));

// Add Check Service node after Parse
const checkServiceNode = {
  parameters: {
    method: 'GET',
    url: 'http://localhost:3001/api/integrations/services/whatsapp/status',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: { response: { response: { neverError: true } }, timeout: 3000 }
  },
  id: 'check-service',
  name: 'Check Service',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4,
  position: [540, 1008],
  credentials: { httpHeaderAuth: { id: 'wbEX2mtUQ8gX5t21', name: 'Backend API Key' } }
};

// Add Check Enabled node
const checkEnabledNode = {
  parameters: {
    jsCode: `const status = $input.first().json;
const parseData = $('Parse').first().json;
if (parseData.route === 'verify') return [{ json: parseData }];
if (parseData.route === 'ignore') return [{ json: parseData }];
if (status.enabled !== true) {
  return [{ json: { route: 'maintenance', phone: parseData.phone, text: parseData.text } }];
}
return [{ json: { ...parseData, serviceEnabled: true } }];`
  },
  id: 'check-enabled',
  name: 'Check Enabled',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [650, 1008]
};

// Add Fmt Maintenance node
const fmtMaintenanceNode = {
  parameters: {
    jsCode: `const p = $('Check Enabled').first().json.phone;
const originalText = $('Check Enabled').first().json.text;
return [{ json: { phone: p, message: '🔧 Sistem bakimda. Lutfen daha sonra tekrar deneyin.', intent: 'maintenance', sentiment: 'neutral', inboundText: originalText } }];`
  },
  id: 'fmt-maintenance',
  name: 'Fmt Maintenance',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [880, 850]
};

// Add Prepare Logs node
const prepareLogsNode = {
  parameters: {
    jsCode: `const data = $input.first().json;
const phone = data.phone;
const inboundText = data.inboundText || $('Parse').first().json.text;
const outboundMessage = data.message;
const intent = data.intent || 'unknown';
const sentiment = data.sentiment || 'neutral';
return [
  { json: { phone, direction: 'inbound', messageText: inboundText, intent, sentiment: 'neutral', logType: 'inbound' } },
  { json: { phone, direction: 'outbound', messageText: outboundMessage, intent, sentiment, logType: 'outbound' } },
  { json: { phone, message: outboundMessage, forSending: true } }
];`
  },
  id: 'prepare-logs',
  name: 'Prepare Logs',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3050, 1024]
};


// Add Filter For Log node
const filterLogNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{ id: 'filter-log', leftValue: '={{ $json.logType }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }],
      combinator: 'and'
    },
    options: {}
  },
  id: 'filter-for-log',
  name: 'Filter For Log',
  type: 'n8n-nodes-base.filter',
  typeVersion: 2,
  position: [3200, 900]
};

// Add Log Interaction node
const logInteractionNode = {
  parameters: {
    method: 'POST',
    url: 'http://localhost:3001/api/integrations/whatsapp/interaction',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ phone: $json.phone, direction: $json.direction, messageText: $json.messageText, intent: $json.intent, sentiment: $json.sentiment }) }}',
    options: { response: { response: { neverError: true } }, timeout: 2000 }
  },
  id: 'log-interaction',
  name: 'Log Interaction',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4,
  position: [3350, 900],
  credentials: { httpHeaderAuth: { id: 'wbEX2mtUQ8gX5t21', name: 'Backend API Key' } }
};

// Add Filter For Send node
const filterSendNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{ id: 'filter-send', leftValue: '={{ $json.forSending }}', rightValue: 'true', operator: { type: 'boolean', operation: 'true' } }],
      combinator: 'and'
    },
    options: {}
  },
  id: 'filter-for-send',
  name: 'Filter For Send',
  type: 'n8n-nodes-base.filter',
  typeVersion: 2,
  position: [3200, 1100]
};

// Add nodes
wf.nodes.push(checkServiceNode, checkEnabledNode, fmtMaintenanceNode, prepareLogsNode, filterLogNode, logInteractionNode, filterSendNode);

// Update connections - route Parse through service check
wf.connections['Parse'] = { main: [[{ node: 'Check Service', type: 'main', index: 0 }]] };
wf.connections['Check Service'] = { main: [[{ node: 'Check Enabled', type: 'main', index: 0 }]] };
wf.connections['Check Enabled'] = { main: [[{ node: 'Router', type: 'main', index: 0 }]] };

// Add maintenance route to Router
const routerNode = wf.nodes.find(n => n.id === 'router');
if (routerNode) {
  routerNode.parameters.rules.values.push({
    conditions: { options: { caseSensitive: false }, conditions: [{ leftValue: '={{ $json.route }}', rightValue: 'maintenance', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
    renameOutput: true,
    outputKey: 'Maintenance'
  });
}

// Update Router connections to include maintenance
wf.connections['Router'] = { main: [
  [{ node: 'Verify Response', type: 'main', index: 0 }],
  [{ node: 'Pre-AI Router', type: 'main', index: 0 }],
  [{ node: 'Ignore Response', type: 'main', index: 0 }],
  [{ node: 'Fmt Maintenance', type: 'main', index: 0 }]
]};

// Route Fmt Maintenance through logging
wf.connections['Fmt Maintenance'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };

// Route all response nodes through Prepare Logs instead of Send WhatsApp
wf.connections['Help Response'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };
wf.connections['Greeting Response'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };
wf.connections['Other Response'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };
wf.connections['Format API Response'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };
wf.connections['Send Clarification'] = { main: [[{ node: 'Prepare Logs', type: 'main', index: 0 }]] };

// Add Prepare Logs connections
wf.connections['Prepare Logs'] = { main: [[
  { node: 'Filter For Log', type: 'main', index: 0 },
  { node: 'Filter For Send', type: 'main', index: 0 }
]] };
wf.connections['Filter For Log'] = { main: [[{ node: 'Log Interaction', type: 'main', index: 0 }]] };
wf.connections['Log Interaction'] = { main: [[{ node: 'OK Response', type: 'main', index: 0 }]] };
wf.connections['Filter For Send'] = { main: [[{ node: 'Send WhatsApp', type: 'main', index: 0 }]] };

fs.writeFileSync('n8n-workflows/workflows-v2/whatsapp-dynamic-ai.json', JSON.stringify(wf, null, 2));
console.log('Updated workflow with', wf.nodes.length, 'nodes and', Object.keys(wf.connections).length, 'connections');