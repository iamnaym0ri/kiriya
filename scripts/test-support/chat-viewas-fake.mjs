const device = new URL(import.meta.url).searchParams.get("device");
export const viewingAs = () => globalThis.__chatViewAs?.[device] ?? null;
export const speaksAsHer = () => false;
export const blockedInPreview = () => false;
export const PREVIEW_MESSAGE = "preview";
