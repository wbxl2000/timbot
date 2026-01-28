/**
 * Author: YanHaidao
 */
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { handleWecomWebhookRequest } from "./src/monitor.js";
import { setWecomRuntime } from "./src/runtime.js";
import { wecomPlugin } from "./src/channel.js";

const plugin = {
  id: "wecom",
  name: "WeCom",
  description: "Clawdbot WeCom (WeChat Work) intelligent bot channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setWecomRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
    api.registerHttpHandler(handleWecomWebhookRequest);
  },
};

export default plugin;
