// Face ID for the chat lock: the same open-source plugin the app's sign-in uses
// (@capgo/capacitor-native-biometric, already in the app). Loaded only inside the iPhone app.
// (Never return or await the plugin object itself: see the note in src/lib/native.js.)
import { isNativeApp } from "../../../lib/native.js";

const biometric = () => import("@capgo/capacitor-native-biometric");

export async function faceIdAvailable() {
  if (!isNativeApp()) return false;
  try {
    const { NativeBiometric } = await biometric();
    const { isAvailable } = await NativeBiometric.isAvailable();
    return Boolean(isAvailable);
  } catch {
    return false;
  }
}

/** Resolves when her face (or finger) matches; rejects if she cancels or it doesn't. */
export async function checkFaceId() {
  const { NativeBiometric } = await biometric();
  await NativeBiometric.verifyIdentity({ reason: "Open our chat", title: "open our chat", useFallback: false, maxAttempts: 3 });
}
