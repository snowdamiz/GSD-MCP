
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { RootsListChangedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');
const { TOOLS } = require('./tools.js');
const { RESOURCES } = require('./resources.js');
const { PROMPTS, getPrompt } = require('./prompts.js');

const server = new McpServer({
  name: 'gsd-mcp-server',
  version: '1.0.0',
});

// ─── Working directory resolution ───
// process.cwd() is unreliable for MCP servers — it reflects the server
// process's own cwd, not the client's project directory.
//
// Resolution order (first match wins):
//   1. project_dir parameter       (passed on any tool call — cached for session)
//   2. --project-dir CLI arg       (set via MCP config "args")
//   3. GSD_PROJECT_DIR env         (set via MCP config "env")
//   4. MCP roots capability        (protocol-standard, not all clients support it)
//   5. process.cwd()               (last resort)

function getStaticProjectDir() {
  const idx = process.argv.indexOf('--project-dir');
  if (idx !== -1 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  if (process.env.GSD_PROJECT_DIR) {
    return path.resolve(process.env.GSD_PROJECT_DIR);
  }
  return null;
}

const _staticDir = getStaticProjectDir();
let _cachedCwd = _staticDir;

async function getProjectDir() {
  if (_cachedCwd) return _cachedCwd;
  try {
    const { roots } = await server.server.listRoots();
    if (roots && roots.length > 0) {
      _cachedCwd = decodeURIComponent(new URL(roots[0].uri).pathname);
      return _cachedCwd;
    }
  } catch {
    // Client doesn't support roots capability — fall through
  }
  _cachedCwd = process.cwd();
  return _cachedCwd;
}

if (!_staticDir) {
  server.server.setNotificationHandler(
    RootsListChangedNotificationSchema,
    async () => { _cachedCwd = null; }
  );
}

// ─── Register Tools (with project_dir injection) ───
// Every tool gets an optional project_dir parameter.  The agent passes it
// once (on whichever tool it calls first), it gets cached, and all later
// calls resolve to the same directory automatically.

for (const tool of TOOLS) {
  const extendedSchema = tool.inputSchema.extend({
    project_dir: z.string().optional().describe(
      'Absolute path to the project root (the repo / workspace directory). ' +
      'Pass this on the first GSD tool call — it is cached for the session.'
    ),
  });

  server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: extendedSchema,
  }, async (args, extra) => {
    if (args.project_dir) {
      _cachedCwd = path.resolve(args.project_dir);
    }
    const cwd = await getProjectDir();
    const { project_dir, ...toolArgs } = args;
    return tool.handler(toolArgs, cwd);
  });
}

// Register Resources
for (const resource of RESOURCES) {
  server.resource(resource.name, resource.uri, { description: resource.description, mimeType: resource.mimeType }, async (uri) => {
    const cwd = await getProjectDir();
    return resource.handler(uri, cwd);
  });
}

// Register Prompts
for (const prompt of PROMPTS) {
  server.prompt(prompt.name, prompt.description, { arguments: prompt.arguments }, async (args) => {
    const cwd = await getProjectDir();
    return getPrompt(prompt.name, args, cwd);
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
