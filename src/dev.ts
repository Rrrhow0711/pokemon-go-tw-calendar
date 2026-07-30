import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { PUBLIC_DIR } from "./config.js";
import { runBuild } from "./index.js";

await runBuild({ fixture: true });

const mimeTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
};

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const decoded = decodeURIComponent(pathname);
    const filePath = path.resolve(PUBLIC_DIR, `.${decoded}`);
    if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("找不到頁面");
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(4173, "127.0.0.1", () => {
  console.log("本機預覽：http://127.0.0.1:4173/");
});
