import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setTimbotRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getTimbotRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Timbot runtime not initialized");
  }
  return runtime;
}
