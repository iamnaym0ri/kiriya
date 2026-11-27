// Where private uploads may live (server routes and the client agree on these).
// chat, stickers and backgrounds were added for the chat (2026-11-24). Their files get unique
// random names and never change, so they're cached on the phone for good instead of re-downloaded.
// events (2026-11-26): pictures the events worker copies from Instagram posts (their links expire).
export const UPLOAD_FOLDERS = ["art", "avatar", "cosplay", "songs", "photos", "chat", "stickers", "backgrounds", "events"];
export const IMMUTABLE_FOLDERS = ["chat", "stickers", "backgrounds", "events"];
