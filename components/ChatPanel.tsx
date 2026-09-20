"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ACUPOINTS } from "@/lib/acupoints";
import type { ChatMessage, PointId, RouterSource } from "@/lib/types";

const EXAMPLES = [
  "I have a tension headache and stiff neck from coding all day.",
  "Nauseous and anxious before a flight.",
  "Wiped out, bloated, and can't sleep.",
];

export default function ChatPanel({
  messages,
  scanning,
  source,
  aiConfigured,
  onSubmit,
  onPick,
}: {
  messages: ChatMessage[];
  scanning: boolean;
  source: RouterSource | null;
  aiConfigured: boolean | null;
  onSubmit: (text: string) => void;
  onPick: (id: PointId) => void;
}) {
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [messages, scanning]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || scanning) return;
    onSubmit(t);
    setDraft("");
  };

  return (
    <section className="chat" aria-label="Symptom router">
      <header className="chat-head">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1 className="brand-name">AcuGuide AI</h1>
            <p className="brand-sub">Symptom → pressure point</p>
          </div>
        </div>
        {aiConfigured !== null && (
          <span
            className={`badge ${aiConfigured ? "badge-live" : "badge-offline"}`}
            title={
              aiConfigured
                ? "Symptoms are routed by Claude, then looked up in the local point database."
                : "No API key set, so routing uses the built-in symptom matcher. Fully offline."
            }
          >
            {aiConfigured ? "AI routing" : "Offline routing"}
          </span>
        )}
      </header>

      <div className="chat-log" ref={log}>
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`bubble ${m.role}`}
            >
              <p>{m.text}</p>
              {m.pointIds && m.pointIds.length > 0 && (
                <div className="chips">
                  {m.pointIds.map((id) => (
                    <button key={id} type="button" className="chip" onClick={() => onPick(id)}>
                      <span className="chip-dot" aria-hidden="true" />
                      {id} · {ACUPOINTS[id].name}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bubble assistant scanning"
            role="status"
            aria-live="polite"
          >
            <span className="scan-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            Scanning meridians…
          </motion.div>
        )}
      </div>

      {messages.length === 0 && !scanning && (
        <div className="examples">
          <p className="eyebrow">Try</p>
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="example" onClick={() => send(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label className="sr-only" htmlFor="symptoms">
          Describe your symptoms
        </label>
        <input
          id="symptoms"
          className="composer-input"
          placeholder="Describe what hurts…"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={scanning}
        />
        <button type="submit" className="btn-primary" disabled={scanning || !draft.trim()}>
          {scanning ? "Scanning…" : "Find points"}
        </button>
      </form>

      <p className="chat-foot">
        {source === "keyword"
          ? "Routed by direct symptom matching."
          : source === "claude"
            ? "Routed by Claude. Point text comes from the local database, never the model."
            : "Educational wellness tool. Not medical advice."}
      </p>
    </section>
  );
}
