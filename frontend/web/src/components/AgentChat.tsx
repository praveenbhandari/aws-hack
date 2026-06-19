import { Bot, Send } from "lucide-react";
import { useState } from "react";
import { fetchAgentChat } from "../api/agent";
import { apiErrorMessage } from "../api/client";

type Props = {
  userLat?: number;
  userLng?: number;
};

export function AgentChat({ userLat, userLng }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetchAgentChat(text, userLat, userLng);
      setMessages((m) => [...m, { role: "agent", text: res.reply }]);
    } catch (e) {
      setError(apiErrorMessage(e, "Agent request failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(100vw-2rem,360px)] h-[420px] rounded-2xl border border-zinc-700 bg-[#0c0c0f]/95 backdrop-blur shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Bot size={18} className="text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">Guardian Agent</p>
              <p className="text-[10px] text-zinc-500">Nebius · routes, hotspots, nearby places</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <p className="text-zinc-500 text-xs">
                Ask for a safe route, nearby restaurant, or safety score at your location.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 max-w-[90%] ${
                  m.role === "user"
                    ? "ml-auto bg-emerald-600/20 text-emerald-100"
                    : "bg-zinc-800/80 text-zinc-200"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && <p className="text-xs text-zinc-500 animate-pulse">Thinking…</p>}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
          <form
            className="p-3 border-t border-zinc-800 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Safe route to Dolores Park…"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg"
      >
        <Bot size={18} />
        {open ? "Close agent" : "Ask Guardian"}
      </button>
    </div>
  );
}
