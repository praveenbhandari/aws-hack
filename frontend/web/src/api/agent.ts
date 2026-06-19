import axios from "axios";
import { GUARDIAN_API_URL } from "../lib/config";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? GUARDIAN_API_URL,
  timeout: 60_000,
});

export type AgentChatResponse = {
  reply: string;
  mode: string;
  usage?: Record<string, unknown> | null;
};

export async function fetchAgentChat(
  message: string,
  userLat?: number,
  userLng?: number,
): Promise<AgentChatResponse> {
  const { data } = await api.post<AgentChatResponse>("/agent/chat", {
    message,
    user_lat: userLat,
    user_lng: userLng,
  });
  return data;
}
