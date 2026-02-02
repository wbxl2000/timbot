/**
 * Author: YanHaidao
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { handleTimbotWebhookRequest } from "./src/monitor.js";
import { setTimbotRuntime } from "./src/runtime.js";
import { timbotPlugin } from "./src/channel.js";

const plugin = {
  id: "timbot",
  name: "Tencent IM",
  description: "Tencent Cloud IM intelligent bot channel via webhooks + REST API",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    setTimbotRuntime(api.runtime);
    api.registerChannel({ plugin: timbotPlugin });
    api.registerHttpHandler(handleTimbotWebhookRequest);
  },
};

export default plugin;
