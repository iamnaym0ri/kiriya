import app from "../server/app.js";

// Vercel runs this one function for every /api/* request. vercel.json rewrites `/api/<route>` to
// `/api?__route=<route>`, so rebuild the original path before handing the request to Hono.
function restorePath(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get("__route");
  if (route === null) return request;
  url.searchParams.delete("__route");
  url.pathname = `/api/${route}`.replace(/\/+$/, "") || "/api";
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

const handler = (request) => app.fetch(restorePath(request));

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
