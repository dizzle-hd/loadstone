import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lodestone } from "../lodestone.js";

export function registerInstanceTools(server: McpServer) {
  server.tool("list_instances", "List all Lodestone server instances with their status", {}, async () => {
    const instances = await lodestone.listInstances();
    const text = instances
      .map(
        (i) =>
          `[${i.uuid}] ${i.name} | ${i.state} | v${i.version} | port ${i.port}` +
          (i.player_count != null
            ? ` | players ${i.player_count}/${i.max_player_count}`
            : "")
      )
      .join("\n");
    return { content: [{ type: "text", text: text || "No instances found." }] };
  });

  server.tool(
    "get_instance_info",
    "Get detailed info about a specific instance",
    { uuid: z.string().describe("Instance UUID") },
    async ({ uuid }) => {
      const info = await lodestone.getInstanceInfo(uuid);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "start_instance",
    "Start a Lodestone server instance",
    { uuid: z.string().describe("Instance UUID") },
    async ({ uuid }) => {
      await lodestone.startInstance(uuid);
      return { content: [{ type: "text", text: `Instance ${uuid} started.` }] };
    }
  );

  server.tool(
    "stop_instance",
    "Stop a Lodestone server instance",
    { uuid: z.string().describe("Instance UUID") },
    async ({ uuid }) => {
      await lodestone.stopInstance(uuid);
      return { content: [{ type: "text", text: `Instance ${uuid} stopped.` }] };
    }
  );

  server.tool(
    "delete_instance",
    "Delete a Lodestone server instance permanently",
    { uuid: z.string().describe("Instance UUID") },
    async ({ uuid }) => {
      await lodestone.deleteInstance(uuid);
      return { content: [{ type: "text", text: `Instance ${uuid} deleted.` }] };
    }
  );

  server.tool(
    "send_console_command",
    "Send a command to a running server's console",
    {
      uuid: z.string().describe("Instance UUID"),
      command: z.string().describe("Command to send (e.g. 'say Hello World')"),
    },
    async ({ uuid, command }) => {
      await lodestone.sendConsoleCommand(uuid, command);
      return {
        content: [
          { type: "text", text: `Command sent to ${uuid}: ${command}` },
        ],
      };
    }
  );

  server.tool(
    "create_paper_instance",
    "Create a new Paper (Minecraft Java) server instance",
    {
      name: z.string().describe("Server name"),
      description: z.string().default("").describe("Server description"),
      version: z
        .string()
        .describe("Minecraft version, e.g. '1.21.1' or '26.1.2'"),
      port: z.number().int().min(1024).max(65535).describe("Server port"),
    },
    async ({ name, description, version, port }) => {
      const result = await lodestone.createPaperInstance(
        name,
        description,
        version,
        port
      );
      return {
        content: [
          {
            type: "text",
            text: `Paper server created. UUID: ${result?.uuid ?? "unknown"}`,
          },
        ],
      };
    }
  );

  server.tool(
    "create_velocity_instance",
    "Create a new Velocity proxy server instance",
    {
      name: z.string().describe("Server name"),
      description: z.string().default("").describe("Server description"),
      version: z.string().describe("Velocity version, e.g. '3.4.0-SNAPSHOT'"),
      port: z
        .number()
        .int()
        .min(1024)
        .max(65535)
        .describe("Proxy port (default 25577)"),
    },
    async ({ name, description, version, port }) => {
      const result = await lodestone.createVelocityInstance(
        name,
        description,
        version,
        port
      );
      return {
        content: [
          {
            type: "text",
            text: `Velocity proxy created. UUID: ${result?.uuid ?? "unknown"}`,
          },
        ],
      };
    }
  );
}
