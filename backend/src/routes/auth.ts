import { Router } from "express";
import { createClient } from "@insforge/sdk";
import { config, hasInsforge } from "../config.js";

export const authRouter = Router();

function getClient(accessToken?: string) {
  return createClient({
    baseUrl: config.insforge.url,
    anonKey: config.insforge.anonKey,
    ...(accessToken ? { accessToken } : {}),
  });
}

authRouter.post("/signup", async (req, res) => {
  if (!hasInsforge()) {
    res.status(503).json({ error: "InsForge not configured" });
    return;
  }
  const { email, password } = req.body ?? {};
  const client = getClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ accessToken: data?.accessToken, user: data?.user });
});

authRouter.post("/signin", async (req, res) => {
  if (!hasInsforge()) {
    res.status(503).json({ error: "InsForge not configured" });
    return;
  }
  const { email, password } = req.body ?? {};
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ accessToken: data?.accessToken, user: data?.user });
});

authRouter.get("/me", async (req, res) => {
  if (!hasInsforge()) {
    res.status(503).json({ error: "InsForge not configured" });
    return;
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  const client = getClient(token);
  const { data, error } = await client.auth.getCurrentUser();
  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }
  res.json({ user: data });
});
