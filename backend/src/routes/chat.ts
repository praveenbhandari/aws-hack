import { Router, type Request, type Response } from "express";
import type OpenAI from "openai";
import { config, hasNebius } from "../config.js";
import { getOpenAIClient } from "../services/nebius.js";

export const chatRouter = Router();

chatRouter.post("/completions", async (req: Request, res: Response) => {
  const body = req.body as {
    model?: string;
    messages?: { role: string; content: string }[];
    stream?: boolean;
  };

  if (!body.stream) {
    res.status(400).json({ error: "stream:true is required for Vapi proxy" });
    return;
  }

  const client = getOpenAIClient();
  if (!client || !hasNebius()) {
    // Fallback SSE for demo without Nebius key
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const chunk = {
      id: "guardian-mock",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content: "I'm Guardian, your travel safety companion. (mock mode — set NEBIUS_API_KEY for live AI)" } }],
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  try {
    const stream = await client.chat.completions.create({
      model: body.model ?? config.nebius.model,
      messages: (body.messages ?? []) as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    console.error("[chat/completions]", e);
    if (!res.headersSent) {
      res.status(502).json({ error: "Nebius streaming failed" });
    } else {
      res.end();
    }
  }
});
