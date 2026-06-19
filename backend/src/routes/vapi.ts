import { Router } from "express";
import { config } from "../config.js";
import { getHotspots, planSafeRoutes, scoreSafety } from "../services/handlers.js";
import { mock } from "../services/mock.js";
import type { VapiToolsRequest, VapiToolsResponse } from "../types/contract.js";

export const vapiRouter = Router();

const TOOL_NAMES = new Set(["get_hotspots", "score_safety", "get_safe_routes"]);

async function dispatchTool(
  name: string,
  params: Record<string, unknown>,
): Promise<{ result: string; message: string }> {
  if (config.useMock) {
    return mock.vapiToolResult(name, "mock");
  }

  if (name === "get_hotspots") {
    const lat = Number(params.lat ?? 37.7749);
    const lng = Number(params.lng ?? -122.4194);
    const radius = Number(params.radius ?? 500);
    const data = await getHotspots(lat, lng, radius);
    return {
      result: JSON.stringify(data),
      message: `Found ${data.count} hotspots within ${radius} meters.`,
    };
  }

  if (name === "score_safety") {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    const radiusMeters = Number(params.radiusMeters ?? 300);
    const data = await scoreSafety(lat, lng, radiusMeters);
    return {
      result: JSON.stringify(data),
      message: `Safety score is ${data.safetyScore} out of 100 (${data.riskLevel} risk).`,
    };
  }

  if (name === "get_safe_routes") {
    const data = await planSafeRoutes({
      origin: (params.origin as string) ?? "Union Square, San Francisco",
      destination: (params.destination as string) ?? "Mission Dolores Park, San Francisco",
      mode: (params.mode as "walking") ?? "walking",
    });
    const best = data.routes[0];
    return {
      result: JSON.stringify(data),
      message: best
        ? `Found ${data.routes.length} route(s). Safest scores ${best.safetyScore} out of 100.`
        : "No routes found.",
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

vapiRouter.post("/tools", async (req, res) => {
  const body = req.body as VapiToolsRequest;
  const toolCalls = body.message?.toolCallList ?? [];

  const results: VapiToolsResponse["results"] = [];
  let lastMessage = "";

  for (const call of toolCalls) {
    const name = call.name;
    const toolCallId = call.id;

    if (!TOOL_NAMES.has(name)) {
      results.push({
        name,
        toolCallId,
        error: `Unknown tool ${name}. Supported: get_hotspots, score_safety, get_safe_routes`,
      });
      continue;
    }

    try {
      const { result, message } = await dispatchTool(name, call.parameters ?? {});
      results.push({ name, toolCallId, result: result.replace(/\n/g, " ") });
      lastMessage = message;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool execution failed";
      results.push({ name, toolCallId, error: msg.replace(/\n/g, " ") });
    }
  }

  const response: VapiToolsResponse = { results };
  if (lastMessage) response.message = { content: lastMessage };

  // Vapi requires 200 even on tool errors
  res.status(200).json(response);
});
