import { Router } from "express";
import { createClient } from "@insforge/sdk";
import { config, hasInsforge } from "../config.js";

export const tripsRouter = Router();

function clientFromReq(req: { headers: { authorization?: string } }) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return createClient({
    baseUrl: config.insforge.url,
    anonKey: config.insforge.anonKey,
    ...(token ? { accessToken: token } : {}),
  });
}

tripsRouter.get("/", async (req, res) => {
  if (!hasInsforge()) {
    res.status(503).json({ error: "InsForge not configured" });
    return;
  }
  const client = clientFromReq(req);
  const { data, error } = await client.database.from("trips").select("*").order("created_at", { ascending: false });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ trips: data ?? [] });
});

tripsRouter.post("/", async (req, res) => {
  if (!hasInsforge()) {
    res.status(503).json({ error: "InsForge not configured" });
    return;
  }
  const { name, origin, destination, mode = "walking" } = req.body ?? {};
  const client = clientFromReq(req);
  const { data: userData } = await client.auth.getCurrentUser();
  const userId = userData?.user?.id;
  const { data, error } = await client.database
    .from("trips")
    .insert([{ name, origin, destination, mode, user_id: userId }])
    .select()
    .single();
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ trip: data });
});
