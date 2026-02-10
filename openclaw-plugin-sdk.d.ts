declare module "openclaw/plugin-sdk" {
  export type OpenClawPluginApi = any;
  export type OpenClawConfig = any;
  export type PluginRuntime = any;
  export type ChannelPlugin<T = any> = any;
  export type ChannelAccountSnapshot = any;
  export type ChannelConfigSchema = any;

  export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

  export type WizardPrompter = {
    note(message: string, title?: string): Promise<void>;
    text(opts: {
      message: string;
      placeholder?: string;
      initialValue?: string;
      validate?: (value: string | undefined) => string | undefined;
    }): Promise<string>;
    confirm(opts: { message: string; initialValue?: boolean }): Promise<boolean>;
    select<T = string>(opts: {
      message: string;
      options: Array<{ value: T; label: string }>;
      initialValue?: T;
    }): Promise<T>;
  };

  export type ChannelOnboardingDmPolicy = {
    label: string;
    channel: string;
    policyKey: string;
    allowFromKey: string;
    getCurrent: (cfg: any) => DmPolicy;
    setPolicy: (cfg: any, policy: DmPolicy) => any;
    promptAllowFrom: (params: { cfg: any; prompter: WizardPrompter }) => Promise<any>;
  };

  export type ChannelOnboardingAdapter = {
    channel: string;
    getStatus: (params: { cfg: any; runtime?: any }) => Promise<{
      channel: string;
      configured: boolean;
      statusLines: string[];
      selectionHint?: string;
      quickstartScore?: number;
    }>;
    configure: (params: {
      cfg: any;
      prompter: WizardPrompter;
      runtime?: any;
      forceAllowFrom?: boolean;
    }) => Promise<{ cfg: any; accountId: string }>;
    dmPolicy?: ChannelOnboardingDmPolicy;
    disable: (cfg: any) => any;
  };

  export function emptyPluginConfigSchema(): any;
  export const DEFAULT_ACCOUNT_ID: string;
  export function normalizeAccountId(id: string | null | undefined): string;
  export function deleteAccountFromConfigSection(...args: any[]): void;
  export function formatPairingApproveHint(...args: any[]): string;
  export function setAccountEnabledInConfigSection(...args: any[]): void;
  export function addWildcardAllowFrom(allowFrom?: any): any;
  export function formatDocsLink(path: string, label: string): string;
}
