import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lodestone } from "../lodestone.js";

export function registerFileTools(server: McpServer) {
  server.tool(
    "list_files",
    "List files and folders inside a server instance at a given path",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z
        .string()
        .default("")
        .describe("Relative path inside the instance (empty = root)"),
    },
    async ({ uuid, path }) => {
      const entries = await lodestone.listFiles(uuid, path);
      const text = entries
        .map(
          (e) =>
            `${e.file_type === "Directory" ? "[DIR] " : "      "}${e.path}` +
            (e.size != null ? ` (${e.size} bytes)` : "")
        )
        .join("\n");
      return {
        content: [{ type: "text", text: text || "(empty directory)" }],
      };
    }
  );

  server.tool(
    "read_file",
    "Read the contents of a text file inside a server instance",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path to the file"),
    },
    async ({ uuid, path }) => {
      const content = await lodestone.readFile(uuid, path);
      return { content: [{ type: "text", text: content }] };
    }
  );

  server.tool(
    "write_file",
    "Write (overwrite) the contents of a file inside a server instance. Creates the file if it does not exist. Protected files (e.g. server.jar, no extension) may be denied.",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path to the file"),
      content: z.string().describe("New full file contents"),
    },
    async ({ uuid, path, content }) => {
      await lodestone.writeFile(uuid, path, content);
      return {
        content: [{ type: "text", text: `Wrote ${content.length} chars to ${path}` }],
      };
    }
  );

  server.tool(
    "create_file",
    "Create a new empty file inside a server instance",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path of the new file"),
    },
    async ({ uuid, path }) => {
      await lodestone.newFile(uuid, path);
      return { content: [{ type: "text", text: `Created file ${path}` }] };
    }
  );

  server.tool(
    "create_directory",
    "Create a new directory inside a server instance",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path of the new directory"),
    },
    async ({ uuid, path }) => {
      await lodestone.makeDirectory(uuid, path);
      return { content: [{ type: "text", text: `Created directory ${path}` }] };
    }
  );

  server.tool(
    "delete_file",
    "Delete a file inside a server instance",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path to the file"),
    },
    async ({ uuid, path }) => {
      await lodestone.deleteFile(uuid, path);
      return { content: [{ type: "text", text: `Deleted file ${path}` }] };
    }
  );

  server.tool(
    "delete_directory",
    "Delete a directory (and its contents) inside a server instance",
    {
      uuid: z.string().describe("Instance UUID"),
      path: z.string().describe("Relative path to the directory"),
    },
    async ({ uuid, path }) => {
      await lodestone.deleteDirectory(uuid, path);
      return { content: [{ type: "text", text: `Deleted directory ${path}` }] };
    }
  );
}
