import { Router } from "express";
import { planSafeRoutes } from "../services/handlers.js";
import type { SafeRoutesRequest } from "../types/contract.js";

export const routesRouter = Router();

routesRouter.post("/safe", async (req, res, next) => {
  try {
    const body = req.body as SafeRoutesRequest;
    if (!body?.origin || !body?.destination) {
      res.status(400).json({ error: "origin and destination are required" });
      return;
    }
    const data = await planSafeRoutes(body);
    res.json(data);
  } catch (e) {
    next(e);
  }
});
