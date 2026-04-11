import express from "express";
import cors from "cors";
import multer from "multer";
import * as os from "node:os";
import * as path from "node:path";
import { healthHandler, durationJsonHandler, durationUploadHandler } from "./routes";

export function createServer(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "500mb" }));

  const upload = multer({
    dest: path.join(os.tmpdir(), "duration-uploads"),
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  app.get("/health", healthHandler);
  app.post("/duration", durationJsonHandler);
  app.post("/duration/upload", upload.array("files"), durationUploadHandler);

  return app;
}

export function startServer(port: number): void {
  const app = createServer();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}
