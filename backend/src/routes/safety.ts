import { Router } from "express";
import { scoreSafety } from "../services/handlers.js";

export const safetyRouter = Router();

safetyRouter.post("/score", async (req, res, next) => {
  try {
    const { lat, lng, radiusMeters = 300 } = req.body ?? {};
    if (typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({ error: "lat and lng are required numbers" });
      return;
    }
    const data = await scoreSafety(lat, lng, radiusMeters);
    res.json(data);
  } catch (e) {
    next(e);
  }
});
