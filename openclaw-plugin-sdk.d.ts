declare module "openclaw/plugin-sdk" {
  export type OpenClawPluginApi = any;
  export type OpenClawConfig = any;
  export type PluginRuntime = any;
  export type ChannelPlugin<T = any> = any;
  export type ChannelAccountSnapshot = any;
  export type ChannelConfigSchema = any;

  export function emptyPluginConfigSchema(): any;
  export const DEFAULT_ACCOUNT_ID: string;
  export function normalizeAccountId(id: string | null | undefined): string;
  export function deleteAccountFromConfigSection(...args: any[]): void;
  export function formatPairingApproveHint(...args: any[]): string;
  export function setAccountEnabledInConfigSection(...args: any[]): void;
}
