import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { hotspotsRouter } from "./routes/hotspots.js";
import { routesRouter } from "./routes/routes.js";
import { safetyRouter } from "./routes/safety.js";
import { tripsRouter } from "./routes/trips.js";
import { vapiRouter } from "./routes/vapi.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    mode: config.useMock ? "mock" : "live",
  });
});

app.use("/hotspots", hotspotsRouter);
app.use("/safety", safetyRouter);
app.use("/routes", routesRouter);
app.use("/vapi", vapiRouter);
app.use("/chat", chatRouter);
app.use("/auth", authRouter);
app.use("/trips", tripsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Guardian Companion API on http://localhost:${config.port}`);
  console.log(`Mode: ${config.useMock ? "MOCK (hour 0)" : "LIVE"}`);
  console.log("Contract: ../API_CONTRACT.md");
});
