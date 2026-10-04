'use strict';
// Minimal JSON-RPC test client for webcontrol-mcp.
// Sends initialize + tools/list (and a tools/call that should fail gracefully
// because no Playwright browsers are guaranteed installed), then prints results.

const { spawn } = require('child_process');
const path = require('path');

const server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
const pending = new Map();
let nextId = 1;

server.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let stderr = '';
server.stderr.on('data', (c) => { stderr += c.toString('utf8'); });

function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout waiting for ' + method));
      }
    }, 15000);
  });
}

(async () => {
  const init = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.0.1' }
  });
  console.log('initialize:', JSON.stringify(init.result.serverInfo));
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const list = await request('tools/list', {});
  const names = list.result.tools.map((t) => t.name);
  console.log('tools/list:', names.join(', '));

  const call = await request('tools/call', { name: 'open_page', arguments: { url: 'about:blank' } });
  console.log('tools/call (expected to fail without browsers): isError=' + call.result.isError);
  console.log(call.result.content[0].text);

  const pass =
    init.result && init.result.serverInfo && init.result.serverInfo.name === 'webcontrol-mcp' &&
    names.length === 5 &&
    ['open_page', 'click', 'fill', 'screenshot', 'get_text'].every((n) => names.includes(n)) &&
    typeof call.result.isError === 'boolean';

  console.log(pass ? 'PASS' : 'FAIL');
  if (stderr.trim()) console.log('server stderr:', stderr.trim());
  server.kill();
  process.exit(pass ? 0 : 1);
})().catch((err) => {
  console.error('TEST ERROR:', err.message);
  if (stderr.trim()) console.error('server stderr:', stderr.trim());
  server.kill();
  process.exit(1);
});
