import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { registerInstanceTools } from "./tools/instances.js";
import { registerFolderTools } from "./tools/folders.js";
import { registerFileTools } from "./tools/files.js";

const PORT = parseInt(process.env.MCP_PORT ?? "3001");

/**
 * Build a fresh McpServer with all tools registered.
 * IMPORTANT: a single McpServer can only be connected to one transport,
 * so we create a new instance per SSE connection — otherwise a second
 * client throws "Already connected to a transport" and crashes the process.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "lodestone",
    version: "1.0.0",
  });
  registerInstanceTools(server);
  registerFolderTools(server);
  registerFileTools(server);
  return server;
}

const app = express();

// Store active transports by session id
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    res.on("close", () => transports.delete(transport.sessionId));
    const server = createServer();
    await server.connect(transport);
  } catch (err) {
    console.error("Failed to establish SSE connection:", err);
    if (!res.headersSent) res.status(500).end();
  }
});

// NOTE: do NOT add body-parsing middleware here — SSEServerTransport
// reads the raw request stream itself in handlePostMessage.
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "lodestone-mcp" });
});

// Last-resort guards so one bad request can never take the whole server down.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lodestone MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(
    `Lodestone URL: ${process.env.LODESTONE_URL ?? "http://localhost:16662"}`
  );
});
