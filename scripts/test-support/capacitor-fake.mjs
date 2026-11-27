// The website has no native plugins: every chat-crypto native call is a no-op here.
export const Capacitor = { isNativePlatform: () => false, isPluginAvailable: () => false };
export const registerPlugin = () => new Proxy({}, { get: () => async () => ({}) });
