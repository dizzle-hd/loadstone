const LODESTONE_URL = process.env.LODESTONE_URL ?? "http://localhost:16662";
const API = `${LODESTONE_URL}/api/v1`;

const LODESTONE_USERNAME = process.env.LODESTONE_USERNAME ?? null;
const LODESTONE_PASSWORD = process.env.LODESTONE_PASSWORD ?? null;

export let authToken: string | null = process.env.LODESTONE_TOKEN ?? null;

export function setAuthToken(token: string) {
  authToken = token;
}

/**
 * Log in with username/password (HTTP Basic) and cache the JWT.
 * Used for the initial token and to refresh after a 401/expiry.
 */
let loginInFlight: Promise<string> | null = null;
async function login(): Promise<string> {
  if (!LODESTONE_USERNAME || !LODESTONE_PASSWORD) {
    throw new Error(
      "No LODESTONE_TOKEN and no LODESTONE_USERNAME/LODESTONE_PASSWORD set — cannot authenticate"
    );
  }
  // Deduplicate concurrent logins.
  if (loginInFlight) return loginInFlight;
  loginInFlight = (async () => {
    const basic = Buffer.from(
      `${LODESTONE_USERNAME}:${LODESTONE_PASSWORD}`
    ).toString("base64");
    const res = await fetch(`${API}/user/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Lodestone login failed → ${res.status}: ${t}`);
    }
    const data = (await res.json()) as { token: string };
    authToken = data.token;
    return data.token;
  })();
  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

/** True if the response indicates the token is missing/expired/invalid. */
function isAuthFailure(status: number, body: string): boolean {
  if (status === 401) return true;
  // Core returns 400 "Authorization header is missing" when no token is sent.
  if (status === 400 && /authorization/i.test(body)) return true;
  return false;
}

/**
 * Fetch wrapper that injects the bearer token and, on an auth failure,
 * logs in again with username/password and retries once.
 */
async function authedFetch(
  url: string,
  init: RequestInit,
  retried = false
): Promise<Response> {
  if (!authToken && (LODESTONE_USERNAME || LODESTONE_PASSWORD)) {
    await login();
  }
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(url, { ...init, headers });

  if (!res.ok && !retried) {
    const peek = await res.clone().text().catch(() => "");
    if (isAuthFailure(res.status, peek) && (LODESTONE_USERNAME || LODESTONE_PASSWORD)) {
      authToken = null;
      await login();
      return authedFetch(url, init, true);
    }
  }
  return res;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await authedFetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lodestone ${method} ${path} → ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

/** Encode a relative path to URL-safe base64 without padding (matches Lodestone's decode_base64). */
function encodePath(relativePath: string): string {
  return Buffer.from(relativePath, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Raw request that sends/returns a plain text body instead of JSON. */
async function rawRequest(
  method: string,
  path: string,
  textBody?: string
): Promise<string> {
  const headers: Record<string, string> = {};
  if (textBody !== undefined) headers["Content-Type"] = "text/plain";

  const res = await authedFetch(`${API}${path}`, {
    method,
    headers,
    body: textBody,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Lodestone ${method} ${path} → ${res.status}: ${t}`);
  }
  return res.text();
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

  // --- Filesystem ---

  listFiles: (uuid: string, relativePath: string) =>
    request<FileEntry[]>(
      "GET",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/ls`
    ),

  readFile: (uuid: string, relativePath: string) =>
    rawRequest("GET", `/instance/${uuid}/fs/${encodePath(relativePath)}/read`),

  writeFile: (uuid: string, relativePath: string, content: string) =>
    rawRequest(
      "PUT",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/write`,
      content
    ),

  newFile: (uuid: string, relativePath: string) =>
    request<void>(
      "PUT",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/new`
    ),

  makeDirectory: (uuid: string, relativePath: string) =>
    request<void>(
      "PUT",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/mkdir`
    ),

  deleteFile: (uuid: string, relativePath: string) =>
    request<void>(
      "DELETE",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/rm`
    ),

  deleteDirectory: (uuid: string, relativePath: string) =>
    request<void>(
      "DELETE",
      `/instance/${uuid}/fs/${encodePath(relativePath)}/rmdir`
    ),
};

export interface FileEntry {
  name: string;
  file_stem: string;
  extension: string | null;
  path: string;
  size: number | null;
  creation_time: number | null;
  modification_time: number | null;
  file_type: "File" | "Directory" | "Unknown";
}
