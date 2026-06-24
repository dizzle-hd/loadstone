import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { registerInstanceTools } from "./tools/instances.js";
import { registerFolderTools } from "./tools/folders.js";

const PORT = parseInt(process.env.MCP_PORT ?? "3001");

const server = new McpServer({
  name: "lodestone",
  version: "1.0.0",
});

registerInstanceTools(server);
registerFolderTools(server);

const app = express();

// Store active transports by session id
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await server.connect(transport);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lodestone MCP server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(
    `Lodestone URL: ${process.env.LODESTONE_URL ?? "http://localhost:16662"}`
  );
});
