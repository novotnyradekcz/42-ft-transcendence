import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(projectRoot, "public", "images");
const maxAvatarBytes = 3 * 1024 * 1024;
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const extensionByMimeType: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function avatarStoragePlugin(): Plugin {
  return {
    name: "avatar-storage",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const url = new URL(request.url, "http://localhost");

        if (request.method !== "POST" || url.pathname !== "/avatar-upload") {
          next();
          return;
        }

        try {
          const mimeType = String(request.headers["content-type"] ?? "").split(";")[0];
          const originalName = url.searchParams.get("filename") ?? "avatar";
          const extension = extensionForUpload(mimeType, originalName);

          if (!extension) {
            sendJson(response, 400, {
              message: "Only PNG, JPEG, WebP, and GIF avatars are supported.",
            });
            return;
          }

          const body = await readRequestBody(request);
          if (body.length > maxAvatarBytes) {
            sendJson(response, 413, {
              message: "Avatar image must be 3 MB or smaller.",
            });
            return;
          }

          await mkdir(imagesDir, { recursive: true });

          const storedName = `${Date.now()}-${randomUUID()}-${safeFileStem(originalName)}${extension}`;
          await writeFile(join(imagesDir, storedName), body);
          sendJson(response, 201, {
            avatarUrl: `/images/${storedName}`,
          });
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : "Avatar upload failed.",
          });
        }
      });
    },
  };
}

function extensionForUpload(mimeType: string, fileName: string) {
  const mimeExtension = extensionByMimeType[mimeType];
  if (mimeExtension) {
    return mimeExtension;
  }

  const fileExtension = extname(fileName).toLowerCase();
  return allowedExtensions.has(fileExtension) ? fileExtension : "";
}

function safeFileStem(fileName: string) {
  const extension = extname(fileName);
  const stem = basename(fileName, extension)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return stem || "avatar";
}

function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, payload: Record<string, string>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [react(), avatarStoragePlugin()],
  server: {
    proxy: {
      "/users": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/friends": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/games": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/discussions": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/mail": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
