/** Runs work after the response is sent (Vercel's waitUntil), or right away outside Vercel. */
export async function background(task) {
  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(Promise.resolve().then(task));
  } catch {
    await task();
  }
}
