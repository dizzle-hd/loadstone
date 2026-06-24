const LODESTONE_URL = process.env.LODESTONE_URL ?? "http://localhost:16662";
const API = `${LODESTONE_URL}/api/v1`;

export let authToken: string | null = process.env.LODESTONE_TOKEN ?? null;

export function setAuthToken(token: string) {
  authToken = token;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lodestone ${method} ${path} → ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

export interface InstanceInfo {
  uuid: string;
  name: string;
  description: string;
  version: string;
  port: number;
  state: string;
  player_count: number | null;
  max_player_count: number | null;
  creation_time: number;
}

function minecraftSetupValue(
  name: string,
  description: string,
  version: string,
  port: number,
  flavour: "Paper" | "Velocity"
) {
  return {
    name,
    description,
    auto_start: false,
    restart_on_crash: false,
    setting_sections: {
      minecraft_config: {
        settings: {
          version: { type: "String", value: version },
          port: { type: "UnsignedInteger", value: port },
        },
      },
    },
    // The game_type is derived from the route path (MinecraftJava)
    // The flavour is part of the setup manifest
    flavour,
  };
}

export const lodestone = {
  listInstances: () => request<InstanceInfo[]>("GET", "/instance/list"),

  startInstance: (uuid: string) =>
    request<void>("PUT", `/instance/${uuid}/start`),

  stopInstance: (uuid: string) =>
    request<void>("PUT", `/instance/${uuid}/stop`),

  deleteInstance: (uuid: string) =>
    request<void>("DELETE", `/instance/${uuid}`),

  getInstanceInfo: (uuid: string) =>
    request<InstanceInfo>("GET", `/instance/${uuid}/info`),

  sendConsoleCommand: (uuid: string, command: string) =>
    request<void>("POST", `/instance/${uuid}/console`, command),

  createPaperInstance: (
    name: string,
    description: string,
    version: string,
    port: number
  ) =>
    request<{ uuid: string }>(
      "POST",
      "/instance/create/MinecraftJava",
      minecraftSetupValue(name, description, version, port, "Paper")
    ),

  createVelocityInstance: (
    name: string,
    description: string,
    version: string,
    port: number
  ) =>
    request<{ uuid: string }>(
      "POST",
      "/instance/create/MinecraftJava",
      minecraftSetupValue(name, description, version, port, "Velocity")
    ),
};
