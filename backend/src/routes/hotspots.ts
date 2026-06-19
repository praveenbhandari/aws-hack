import { Router } from "express";
import { getHotspots } from "../services/handlers.js";

export const hotspotsRouter = Router();

hotspotsRouter.get("/", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 500);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: "lat and lng are required numbers" });
      return;
    }

    const data = await getHotspots(lat, lng, radius);
    res.json(data);
  } catch (e) {
    next(e);
  }
});
