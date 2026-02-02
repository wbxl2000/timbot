/**
 * Timbot 日志工具
 *
 * 使用方式：
 * - logSimple: 无运行时上下文时使用
 * - log/logVerbose: 有 TimbotWebhookTarget 时使用（在 monitor.ts 中）
 *
 * 日志级别：
 * - info: 关键事件（启动、收发消息成功）
 * - warn: 可忽略但需注意（配置缺失、跳过处理）
 * - error: 真正的错误（发送失败、签名错误）
 *
 * 查看日志：
 * - openclaw logs --follow
 * - openclaw gateway --verbose（显示 verbose 级别）
 */

export const LOG_PREFIX = "[timbot]";

/** 简易日志（无运行时上下文） */
export function logSimple(level: "info" | "warn" | "error", message: string): void {
  const full = `${LOG_PREFIX} ${message}`;
  if (level === "error") console.error(full);
  else if (level === "warn") console.warn(full);
  else console.log(full);
}

/** Debug 级别日志（仅在 logging.level=debug 时写入文件） */
export function logDebug(message: string): void {
  console.debug(`${LOG_PREFIX} ${message}`);
}
