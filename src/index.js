#!/usr/bin/env node
'use strict';

const readline = require('readline');

let playwright = null;

function loadPlaywright() {
  if (playwright) return playwright;
  try {
    playwright = require('playwright');
  } catch (err) {
    throw new Error(
      'Playwright is not installed. Run `npm install playwright` inside the webcontrol-mcp package, then `npx playwright install chromium`.'
    );
  }
  return playwright;
}

const TOOLS = [
  {
    name: 'open_page',
    description: 'Open a URL in the controlled browser and wait for it to load. Returns the page title.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to open, e.g. https://example.com' }
      },
      required: ['url']
    }
  },
  {
    name: 'click',
    description: 'Click an element on the current page, located by a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click' }
      },
      required: ['selector']
    }
  },
  {
    name: 'fill',
    description: 'Type text into an input field on the current page.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input element' },
        text: { type: 'string', description: 'Text to type into the field' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'screenshot',
    description: 'Take a PNG screenshot of the current page. Returns the image as base64.',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture the full scrollable page (default false)' }
      }
    }
  },
  {
    name: 'get_text',
    description: 'Get the visible text content of the page, or of an element matching a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector to scope the text extraction' }
      }
    }
  }
];

let browser = null;
let page = null;

async function ensurePage() {
  if (page) return page;
  const pw = loadPlaywright();
  try {
    browser = await pw.chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      'Could not launch Chromium. Browsers may not be installed — run `npx playwright install chromium`. (' + err.message + ')'
    );
  }
  const context = await browser.newContext();
  page = await context.newPage();
  return page;
}

const handlers = {
  async open_page(args) {
    const p = await ensurePage();
    await p.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return 'Opened: ' + args.url + '\nTitle: ' + (await p.title());
  },
  async click(args) {
    const p = await ensurePage();
    await p.click(args.selector, { timeout: 10000 });
    return 'Clicked: ' + args.selector;
  },
  async fill(args) {
    const p = await ensurePage();
    await p.fill(args.selector, args.text, { timeout: 10000 });
    return 'Filled ' + args.selector + ' with ' + JSON.stringify(args.text);
  },
  async screenshot(args) {
    const p = await ensurePage();
    const buf = await p.screenshot({ fullPage: !!args.fullPage });
    return {
      image: buf.toString('base64'),
      mimeType: 'image/png'
    };
  },
  async get_text(args) {
    const p = await ensurePage();
    if (args.selector) {
      const el = p.locator(args.selector).first();
      return await el.innerText({ timeout: 10000 });
    }
    return await p.innerText('body');
  }
};

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handleRequest(req) {
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'webcontrol-mcp', version: '1.0.0' }
        }
      });
      break;
    case 'notifications/initialized':
      break;
    case 'tools/list':
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      break;
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) {
        send({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Unknown tool: ' + params.name }
        });
        break;
      }
      try {
        const result = await handlers[params.name](params.arguments || {});
        const content = typeof result === 'string' ? [{ type: 'text', text: result }] : [{ type: 'text', text: JSON.stringify(result) }];
        send({ jsonrpc: '2.0', id, result: { content, isError: false } });
      } catch (err) {
        send({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true }
        });
      }
      break;
    }
    case 'ping':
      send({ jsonrpc: '2.0', id, result: {} });
      break;
    default:
      if (id !== undefined) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
      }
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req;
    try {
      req = JSON.parse(trimmed);
    } catch {
      continue;
    }
    try {
      await handleRequest(req);
    } catch (err) {
      if (req && req.id !== undefined) {
        send({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: 'Internal error: ' + err.message } });
      }
    }
  }
  if (browser) await browser.close();
}

main().catch((err) => {
  process.stderr.write('webcontrol-mcp fatal: ' + err.message + '\n');
  process.exit(1);
});
