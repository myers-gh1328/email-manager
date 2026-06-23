import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';

const server = createMcpServer();
const transport = new StdioServerTransport();

async function connectServer() {
  try {
    await server.connect(transport);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MCP server failed to start.');
    process.exitCode = 1;
  }
}

connectServer();
