import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR ?? "/data";
const FOLDERS_FILE = path.join(DATA_DIR, "folders.json");

interface Folder {
  id: string;
  name: string;
  instanceUuids: string[];
}

function loadFolders(): Record<string, Folder> {
  try {
    if (!fs.existsSync(FOLDERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(FOLDERS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveFolders(folders: Record<string, Folder>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify(folders, null, 2), "utf-8");
}

export function registerFolderTools(server: McpServer) {
  server.tool("list_folders", "List all server folders", {}, async () => {
    const folders = loadFolders();
    const entries = Object.values(folders);
    if (entries.length === 0)
      return { content: [{ type: "text", text: "No folders created yet." }] };
    const text = entries
      .map(
        (f) =>
          `[${f.id}] ${f.name} — ${f.instanceUuids.length} server(s): ${f.instanceUuids.join(", ") || "none"}`
      )
      .join("\n");
    return { content: [{ type: "text", text }] };
  });

  server.tool(
    "create_folder",
    "Create a new folder to organize server instances",
    { name: z.string().describe("Folder name") },
    async ({ name }) => {
      const folders = loadFolders();
      const id = crypto.randomUUID();
      folders[id] = { id, name, instanceUuids: [] };
      saveFolders(folders);
      return {
        content: [{ type: "text", text: `Folder "${name}" created (id: ${id})` }],
      };
    }
  );

  server.tool(
    "move_to_folder",
    "Move a server instance into a folder",
    {
      instanceUuid: z.string().describe("Instance UUID to move"),
      folderId: z.string().describe("Target folder ID"),
    },
    async ({ instanceUuid, folderId }) => {
      const folders = loadFolders();

      // Remove from any existing folder
      for (const folder of Object.values(folders)) {
        folder.instanceUuids = folder.instanceUuids.filter(
          (u) => u !== instanceUuid
        );
      }

      if (!folders[folderId]) {
        return {
          content: [{ type: "text", text: `Folder ${folderId} not found.` }],
          isError: true,
        };
      }

      folders[folderId].instanceUuids.push(instanceUuid);
      saveFolders(folders);
      return {
        content: [
          {
            type: "text",
            text: `Instance ${instanceUuid} moved to folder "${folders[folderId].name}"`,
          },
        ],
      };
    }
  );

  server.tool(
    "remove_from_folder",
    "Remove a server instance from its folder",
    { instanceUuid: z.string().describe("Instance UUID to remove from folder") },
    async ({ instanceUuid }) => {
      const folders = loadFolders();
      let removed = false;
      for (const folder of Object.values(folders)) {
        const before = folder.instanceUuids.length;
        folder.instanceUuids = folder.instanceUuids.filter(
          (u) => u !== instanceUuid
        );
        if (folder.instanceUuids.length < before) removed = true;
      }
      saveFolders(folders);
      return {
        content: [
          {
            type: "text",
            text: removed
              ? `Instance ${instanceUuid} removed from its folder.`
              : `Instance ${instanceUuid} was not in any folder.`,
          },
        ],
      };
    }
  );

  server.tool(
    "delete_folder",
    "Delete a folder (instances are not deleted, just ungrouped)",
    { folderId: z.string().describe("Folder ID to delete") },
    async ({ folderId }) => {
      const folders = loadFolders();
      if (!folders[folderId]) {
        return {
          content: [{ type: "text", text: `Folder ${folderId} not found.` }],
          isError: true,
        };
      }
      const name = folders[folderId].name;
      delete folders[folderId];
      saveFolders(folders);
      return {
        content: [{ type: "text", text: `Folder "${name}" deleted.` }],
      };
    }
  );
}
