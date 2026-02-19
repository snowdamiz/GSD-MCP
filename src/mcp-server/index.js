
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TOOLS } = require('./tools.js');
const { RESOURCES, handleDynamicResource } = require('./resources.js');
const { PROMPTS, getPrompt } = require('./prompts.js');

const server = new McpServer({
  name: 'gsd-mcp-server',
  version: '1.0.0',
});

// Register Tools
for (const tool of TOOLS) {
  server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
    return tool.handler(args, process.cwd());
  });
}

// Register Resources
for (const resource of RESOURCES) {
  server.resource(resource.name, resource.uri, { description: resource.description, mimeType: resource.mimeType }, async (uri) => {
    return resource.handler(uri, process.cwd());
  });
}

// Register Dynamic Resource Handler?
// The SDK doesn't expose a clean way to register regex patterns in the simplified McpServer class.
// We'd typically use server.server.setRequestHandler(ReadResourceRequestSchema, ...) for low level control.
// However, looking at the SDK, `server.resource` helper takes a specific URI.
// For dynamic resources, we might need to rely on the client listing resources or just implement it if the SDK supports patterns.
// As of now, I'll stick to static resources for simplicity or assume future SDK features.
// If needed, I would use the lower-level `server.server` object.

// Register Prompts
for (const prompt of PROMPTS) {
  server.prompt(prompt.name, prompt.description, { arguments: prompt.arguments }, async (args) => {
    return getPrompt(prompt.name, args, process.cwd());
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
