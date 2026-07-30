export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, details: Record<string, unknown> = {}): void {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/(token|authorization|secret)/iu.test(key)),
  );
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeDetails,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
