
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TOOLS } = require('./tools.js');
const { RESOURCES } = require('./resources.js');
const { PROMPTS, getPrompt } = require('./prompts.js');

const server = new McpServer({
  name: 'gsd-mcp-server',
  version: '1.0.0',
});

// Register Tools
for (const tool of TOOLS) {
  server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, async (args, extra) => {
    return tool.handler(args, process.cwd());
  });
}

// Register Resources
for (const resource of RESOURCES) {
  server.resource(resource.name, resource.uri, { description: resource.description, mimeType: resource.mimeType }, async (uri) => {
    return resource.handler(uri, process.cwd());
  });
}

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
