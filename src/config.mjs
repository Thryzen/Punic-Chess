const DEFAULT_CONFIG_URL = "./game.config.json";
const DEFAULT_CORE_CLIENT_MODULE_URL = "./Core/client/board-games-core.mjs";

export function normalizeGameConfig(rawConfig = {}) {
  const signalingUrl = rawConfig.online?.signalingUrl;
  if (!signalingUrl || typeof signalingUrl !== "string") {
    throw new Error("online.signalingUrl is required");
  }
  return {
    online: {
      signalingUrl: signalingUrl.trim(),
      coreClientModuleUrl: String(rawConfig.online?.coreClientModuleUrl ?? DEFAULT_CORE_CLIENT_MODULE_URL).trim(),
    },
  };
}

export async function loadGameConfig({ configUrl = DEFAULT_CONFIG_URL, fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) throw new Error("fetch is required to load game config");
  const response = await fetchImpl(configUrl);
  if (!response.ok) throw new Error(`could not load game config: ${configUrl}`);
  return normalizeGameConfig(await response.json());
}
