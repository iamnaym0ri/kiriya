import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { useSession } from "./session.js";
import { currentSurpriseState, disableSurprises, enableSurprises, isIos, isStandalone, pushSupported } from "./pwa.js";

export const pushStatusKey = ["push", "status"];

/** Whether this device can get notifications, and if not, why. */
export function surpriseSupport() {
  if (isIos() && !isStandalone()) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return isIos() ? "update-ios" : "unsupported";
  if (!pushSupported()) return "not-configured";
  return "ok";
}

/**
 * This device's notification switch. Turning on must start straight from a tap: iOS only shows its
 * permission prompt inside the gesture. Delivery hours are Kiriya's; an admin phone only subscribes,
 * so testing never changes when her surprises arrive.
 */
export function useSurprises() {
  const queryClient = useQueryClient();
  const role = useSession().data?.role;
  const support = surpriseSupport();
  const status = useQuery({ queryKey: pushStatusKey, queryFn: () => api("/push/status"), enabled: Boolean(role) });
  const [state, setState] = useState(support === "ok" ? "checking" : "unavailable");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const settings = status.data?.settings;
  const ownsSettings = role === "kiriya";

  useEffect(() => {
    if (support !== "ok") return;
    let live = true;
    currentSurpriseState()
      .then((next) => live && setState(next))
      .catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, [support]);

  const saveSettings = useMutation({
    mutationFn: (body) => api("/push/settings", { method: "PUT", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushStatusKey }),
  });

  async function turnOn() {
    setMessage(null);
    setBusy(true);
    try {
      const result = await enableSurprises();
      setState(result.state === "error" ? "off" : result.state);
      if (result.state === "on" && ownsSettings && settings && !settings.enabled)
        await saveSettings.mutateAsync({ ...settings, enabled: true });
      if (result.state === "error") setMessage(`That didn’t work: ${result.message}`);
      queryClient.invalidateQueries({ queryKey: pushStatusKey });
      return result.state;
    } catch (error) {
      setMessage(error.message);
      return "error";
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setMessage(null);
    setBusy(true);
    try {
      if (ownsSettings && settings) await saveSettings.mutateAsync({ ...settings, enabled: false });
      setState((await disableSurprises()).state);
      queryClient.invalidateQueries({ queryKey: pushStatusKey });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return { role, support, state, settings, ownsSettings, saveSettings, message, setMessage, busy, turnOn, turnOff };
}
