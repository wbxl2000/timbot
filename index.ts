/**
 * Author: YanHaidao
 */
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { handleTimbotWebhookRequest } from "./src/monitor.js";
import { setTimbotRuntime } from "./src/runtime.js";
import { timbotPlugin } from "./src/channel.js";

const plugin = {
  id: "timbot",
  name: "Tencent IM",
  description: "Clawdbot Tencent Cloud IM intelligent bot channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    console.log(`[timbot] 插件注册中...`);
    setTimbotRuntime(api.runtime);
    api.registerChannel({ plugin: timbotPlugin });
    api.registerHttpHandler(handleTimbotWebhookRequest);
    console.log(`[timbot] 插件注册完成`);
  },
};

export default plugin;
