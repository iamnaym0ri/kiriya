import { env } from "../env.js";

export function blobUploadMode(config = env) {
  if (config.blobStoreId && config.blobWebhookPublicKey) return "presigned";
  return config.blobToken ? "token" : null;
}

export function blobReadConfigured(config = env) {
  return Boolean(config.blobStoreId || config.blobToken);
}

export function blobOptions(config = env) {
  // The SDK reads and refreshes Vercel's OIDC token itself. Never cache that token or send it
  // to a browser. A legacy static token remains supported for stores connected that way.
  return config.blobStoreId
    ? { storeId: config.blobStoreId }
    : { token: config.blobToken };
}
