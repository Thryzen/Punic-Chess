function defaultBaseUrl() {
  return globalThis.document?.baseURI ?? import.meta.url;
}

export function resolveCoreClientModuleUrl(moduleUrl, baseUrl = defaultBaseUrl()) {
  return new URL(moduleUrl, baseUrl).href;
}

export async function loadBoardGamesCoreClient({
  gameConfig,
  baseUrl = defaultBaseUrl(),
  importModule = (url) => import(url),
} = {}) {
  const moduleUrl = gameConfig?.online?.coreClientModuleUrl;
  if (!moduleUrl) throw new Error("online.coreClientModuleUrl is required");

  const resolvedModuleUrl = resolveCoreClientModuleUrl(moduleUrl, baseUrl);
  const module = await importModule(resolvedModuleUrl);
  if (typeof module.BoardGamesCoreClient !== "function") {
    throw new Error(`Core client module ${resolvedModuleUrl} is missing the BoardGamesCoreClient export`);
  }
  return module.BoardGamesCoreClient;
}
