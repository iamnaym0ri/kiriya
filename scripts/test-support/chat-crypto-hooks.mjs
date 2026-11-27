// Node module hooks for scripts/test-chat-crypto.mjs: the chat's client crypto (src/lib/chatCrypto*)
// runs in Node against the real server, with two stand-ins for what only exists in a browser or the
// app (src/lib/api.js reads import.meta.env; @capacitor/core wants a window). Each simulated device
// imports the modules with its own `?device=<name>`, which these hooks carry down the import tree,
// so every device has its own keyring and its own storage, like separate phones.
const here = new URL("./", import.meta.url);
const FAKES = {
  "api.js": new URL("chat-api-fake.mjs", here).href,
  "viewAs.js": new URL("chat-viewas-fake.mjs", here).href,
};
const CAPACITOR = new URL("capacitor-fake.mjs", here).href;

export async function resolve(specifier, context, next) {
  const parent = context.parentURL ? new URL(context.parentURL) : null;
  const device = parent?.searchParams.get("device");
  const inCrypto = parent && /\/src\/lib\/chatCrypto(?:\.js|\/)/.test(parent.pathname);
  if (inCrypto && specifier === "@capacitor/core") return { url: `${CAPACITOR}?device=${device ?? ""}`, shortCircuit: true };
  if (inCrypto) {
    const name = specifier.split("/").pop();
    if (specifier.startsWith(".") && FAKES[name] && !specifier.includes("chatCrypto")) return { url: `${FAKES[name]}?device=${device ?? ""}`, shortCircuit: true };
  }
  const resolved = await next(specifier, context);
  if (device && inCrypto && resolved.url.startsWith("file:") && /\/src\/lib\/chatCrypto(?:\.js|\/)/.test(resolved.url)) {
    const url = new URL(resolved.url);
    url.searchParams.set("device", device);
    return { ...resolved, url: url.href };
  }
  return resolved;
}
