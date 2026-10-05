import { meta } from "@/data";

// Opt-in, cookie-free counting through GoatCounter (https://www.goatcounter.com), set in meta.json:
//   "analytics": { "kind": "goatcounter", "code": "<your site code>" }
// With "analytics": null (the default) no script loads and track() does nothing. GoatCounter counts page views on
// its own; track() adds events for what readers do on the page. No cookies, no personal data, no form posts.

interface GoatCounter {
  count?: (v: { path: string; title?: string; event?: boolean }) => void;
}
declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

export const goatcounterEndpoint = (code: string) => `https://${code}.goatcounter.com/count`;

// Events from before the script has loaded wait here, and go out once it has (see flush).
const pending: { path: string; title: string }[] = [];

/** Count an event, e.g. track("copy-link/google"). A no-op when analytics is off. */
export function track(event: string, title = event) {
  if (!meta.analytics || typeof window === "undefined") return;
  const count = window.goatcounter?.count;
  if (count) count({ path: event, title, event: true });
  else pending.push({ path: event, title });
}

/** Send anything tracked before GoatCounter's script finished loading. */
export function flush() {
  const count = window.goatcounter?.count;
  if (count) for (const e of pending.splice(0)) count({ ...e, event: true });
}
