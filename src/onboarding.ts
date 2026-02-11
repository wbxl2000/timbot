import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingDmPolicy,
  OpenClawConfig,
  DmPolicy,
  WizardPrompter,
} from "openclaw/plugin-sdk";
import { addWildcardAllowFrom, DEFAULT_ACCOUNT_ID, formatDocsLink } from "openclaw/plugin-sdk";
import type { TimbotConfig } from "./types.js";
import { resolveTimbotAccount } from "./accounts.js";

const channel = "timbot" as const;

function setTimbotDmPolicy(cfg: OpenClawConfig, dmPolicy: DmPolicy): OpenClawConfig {
  const allowFrom =
    dmPolicy === "open"
      ? addWildcardAllowFrom(cfg.channels?.timbot?.dm?.allowFrom)?.map((entry: any) => String(entry))
      : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      timbot: {
        ...cfg.channels?.timbot,
        dm: {
          ...cfg.channels?.timbot?.dm,
          policy: dmPolicy,
          ...(allowFrom ? { allowFrom } : {}),
        },
      },
    },
  };
}

function setTimbotAllowFrom(cfg: OpenClawConfig, allowFrom: string[]): OpenClawConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      timbot: {
        ...cfg.channels?.timbot,
        dm: {
          ...cfg.channels?.timbot?.dm,
          allowFrom,
        },
      },
    },
  };
}

function parseAllowFromInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptTimbotAllowFrom(params: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
}): Promise<OpenClawConfig> {
  const existing = (params.cfg.channels?.timbot as TimbotConfig | undefined)?.dm?.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist Tencent IM DMs by user account ID.",
      "You can find user account in the Tencent Cloud IM console.",
      "Examples:",
      "- user_001",
      "- admin_test",
    ].join("\n"),
    "Tencent IM allowlist",
  );

  while (true) {
    const entry = await params.prompter.text({
      message: "Tencent IM allowFrom (user account IDs)",
      placeholder: "user_001, user_002",
      initialValue: existing[0] ? String(existing[0]) : undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
    });
    const parts = parseAllowFromInput(String(entry));
    if (parts.length === 0) {
      await params.prompter.note("Enter at least one user.", "Tencent IM allowlist");
      continue;
    }

    const unique = [
      ...new Set([
        ...existing.map((v: string | number) => String(v).trim()).filter(Boolean),
        ...parts,
      ]),
    ];
    return setTimbotAllowFrom(params.cfg, unique);
  }
}

async function noteTimbotCredentialHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "You'll need 3 values from Tencent Cloud IM Console:",
      "",
      "• SDKAppID & SecretKey → https://console.cloud.tencent.com/im",
      "• Callback Token       → https://console.cloud.tencent.com/im/callback-setting",
      "",
      "Full setup guide: https://github.com/wbxl2000/timbot",
    ].join("\n"),
    "Tencent IM credentials",
  );
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Tencent IM",
  channel,
  policyKey: "channels.timbot.dm.policy",
  allowFromKey: "channels.timbot.dm.allowFrom",
  getCurrent: (cfg) =>
    (cfg.channels?.timbot as TimbotConfig | undefined)?.dm?.policy ?? "open",
  setPolicy: (cfg, policy) => setTimbotDmPolicy(cfg, policy),
  promptAllowFrom: promptTimbotAllowFrom,
};

export const timbotOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const account = resolveTimbotAccount({ cfg: cfg as OpenClawConfig });
    const configured = account.configured;

    const statusLines: string[] = [];
    if (!configured) {
      statusLines.push("Tencent IM: needs sdkAppId + secretKey");
    } else {
      statusLines.push(
        `Tencent IM: configured (sdkAppId=${account.sdkAppId ?? "?"})`,
      );
    }

    return {
      channel,
      configured,
      statusLines,
      selectionHint: configured ? "configured" : "needs credentials",
      quickstartScore: configured ? 2 : 0,
    };
  },

  configure: async ({ cfg, prompter }) => {
    const timbotCfg = cfg.channels?.timbot as TimbotConfig | undefined;
    const hasConfigCreds = Boolean(timbotCfg?.sdkAppId?.trim() && timbotCfg?.secretKey?.trim());

    let next = cfg;
    let sdkAppId: string | null = null;
    let secretKey: string | null = null;
    let token: string | null = null;

    if (!hasConfigCreds) {
      await noteTimbotCredentialHelp(prompter);
    }

    if (hasConfigCreds) {
      const keep = await prompter.confirm({
        message: "Tencent IM credentials already configured. Keep them?",
        initialValue: true,
      });
      if (!keep) {
        sdkAppId = String(
          await prompter.text({
            message: "Enter SDKAppID (from IM console app overview)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
        secretKey = String(
          await prompter.text({
            message: "Enter SecretKey (from IM console app overview, click Show)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
        token = String(
          await prompter.text({
            message: "Enter Webhook Token (from Callback Configuration)",
            validate: (value) => (value?.trim() ? undefined : "Required"),
          }),
        ).trim();
      }
    } else {
      sdkAppId = String(
        await prompter.text({
          message: "Enter SDKAppID (from IM console app overview)",
          placeholder: "e.g. 1600012345",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
      secretKey = String(
        await prompter.text({
          message: "Enter SecretKey (from IM console app overview, click Show)",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
      token = String(
        await prompter.text({
          message: "Enter Webhook Token (from Callback Configuration)",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
    }

    if (sdkAppId && secretKey) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          timbot: {
            ...next.channels?.timbot,
            enabled: true,
            sdkAppId,
            secretKey,
            ...(token ? { token } : {}),
            botAccount: "@RBT#001",
            webhookPath: "/timbot",
            dm: { policy: "open" as const },
          },
        },
      };
    }

    // 保留已有配置时，确保 enabled 为 true 且默认值存在
    next = {
      ...next,
      channels: {
        ...next.channels,
        timbot: {
          botAccount: "@RBT#001",
          webhookPath: "/timbot",
          dm: { policy: "open" as const },
          ...next.channels?.timbot,
          enabled: true,
        },
      },
    };

    return { cfg: next, accountId: DEFAULT_ACCOUNT_ID };
  },

  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      timbot: { ...cfg.channels?.timbot, enabled: false },
    },
  }),
};
