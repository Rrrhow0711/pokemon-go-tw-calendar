import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

export async function readJson<T>(
  filePath: string,
  schema: z.ZodType<T>,
  fallback?: T,
): Promise<T> {
  try {
    const text = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(text) as unknown);
  } catch (error: unknown) {
    if (fallback !== undefined && isMissingFile(error)) {
      return fallback;
    }
    throw new Error(`無法讀取或驗證 ${filePath}: ${errorMessage(error)}`, { cause: error });
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextAtomic(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, value, "utf8");
  await rename(temporaryPath, filePath);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
