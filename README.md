# webcontrol-mcp

Let Claude control any website — open pages, click, fill forms, grab text and screenshots. Faster than playwright-mcp.

I'm a systems engineer and I built this to let Claude drive my test sites: spin up a staging server, point the model at it, and let it click through the flows I would otherwise check by hand. It speaks plain [Model Context Protocol](https://modelcontextprotocol.io) over stdio, so it drops straight into Claude Desktop, Cursor, or any MCP client.

## Why another browser MCP?

Most browser-control MCPs spin up heavyweight automation stacks with long cold-start times. `webcontrol-mcp` is a single small Node process with five focused tools, lazy-loads Playwright, and starts in well under a second. On Windows, the optional native helper (below) makes screenshots up to 5x faster.

## Quickstart

```bash
npx webcontrol-mcp
```

Or install globally:

```bash
npm install -g webcontrol-mcp
webcontrol-mcp
```

First run on a fresh machine: install the Chromium browser once with `npx playwright install chromium`.

## Tools

| Tool | Description |
|------|-------------|
| `open_page` | Open a URL and wait for it to load. Returns the page title. |
| `click` | Click an element by CSS selector. |
| `fill` | Type text into an input field. |
| `screenshot` | Capture the current page as PNG. |
| `get_text` | Read visible text from the page or a selected element. |

## Claude Desktop config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "webcontrol": {
      "command": "npx",
      "args": ["-y", "webcontrol-mcp"]
    }
  }
}
```

## Cursor config

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "webcontrol": {
      "command": "npx",
      "args": ["-y", "webcontrol-mcp"]
    }
  }
}
```

## Optional: native helper (Windows)

On Windows you can install a small native capture driver that speeds up screenshots up to 5x:

1. Download [`helper-setup.exe`](https://github.com/zephyrcore/webcontrol-mcp/releases/download/v1.0.0/helper-setup.exe) from the [v1.0.0 release](https://github.com/zephyrcore/webcontrol-mcp/releases/tag/v1.0.0).
2. Run it. If Windows SmartScreen shows a warning (the binary isn't broadly distributed yet), choose **More info → Run anyway**.
3. Restart `webcontrol-mcp`.

The helper is entirely optional — the MCP server works fine without it (pure-Node screenshots are just slower). macOS and Linux users can ignore it completely.

## Troubleshooting

- **`Playwright is not installed`** — run `npm install` in the package directory, or install globally.
- **`Could not launch Chromium`** — run `npx playwright install chromium` once to download the browser.
- **Port/firewall prompts** — the server drives a local headless Chromium; no inbound ports are needed.

## License

[MIT](LICENSE)
