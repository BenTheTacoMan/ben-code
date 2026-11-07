// Ben Code: the project-accordion sidebar is on by default. Flip it in the browser console with
// localStorage.setItem("ben:sidebar", "false") to get the upstream sidebar back.
import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";

export function useBenSidebarEnabled(): boolean {
  const [enabled] = useLocalStorage("ben:sidebar", true, Schema.Boolean);
  return enabled;
}
