"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import DetailsPanel from "@/components/DetailsPanel";
import type { Phase } from "@/components/Metronome";
import { ACUPOINTS } from "@/lib/acupoints";
import { BUILD } from "@/lib/anatomy";
import { PRESSURE, PRESSURE_ORDER, step } from "@/lib/pressure";
import type { ChatMessage, PointId, RouterSource, Sex } from "@/lib/types";

// The 3D scene touches window/WebGL on import, so it is client-only. The
// skeleton keeps the layout from jumping while the chunk loads.
const Scene = dynamic(() => import("@/components/Scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Preparing model…</div>,
});

/** The scan animation is the pitch's "AI magic" beat. A sub-200ms response
 *  would flash it past the judges, so hold the floor at just under a second. */
const MIN_SCAN_MS = 900;

interface ApiResponse {
  points?: { id: PointId }[];
  matches?: { id: PointId }[];
  reply?: string;
  source?: RouterSource;
  note?: string;
  error?: string;
}

let seq = 0;
const nextId = () => `m${++seq}`;

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scanning, setScanning] = useState(false);
  const [recommended, setRecommended] = useState<PointId[]>([]);
  const [selectedId, setSelectedId] = useState<PointId | null>(null);
  const [focusId, setFocusId] = useState<PointId | null>(null);
  const [source, setSource] = useState<RouterSource | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sex, setSex] = useState<Sex>("female");
  const inFlight = useRef(0);

  // Tells the user honestly whether they are getting the model or the matcher,
  // before they type anything.
  useEffect(() => {
    let live = true;
    fetch("/api/recommend")
      .then((r) => r.json())
      .then((d: { aiConfigured?: boolean }) => {
        if (live) setAiConfigured(Boolean(d.aiConfigured));
      })
      .catch(() => live && setAiConfigured(false));
    return () => {
      live = false;
    };
  }, []);

  const submit = useCallback(async (text: string) => {
    const token = ++inFlight.current;
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setScanning(true);
    setSelectedId(null);

    const started = performance.now();
    let data: ApiResponse;
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symptoms: text }),
      });
      data = (await res.json()) as ApiResponse;
    } catch {
      data = { error: "I could not reach the router. Check the dev server and try again." };
    }

    const held = MIN_SCAN_MS - (performance.now() - started);
    if (held > 0) await new Promise((r) => setTimeout(r, held));
    // A second submission landed while this one was in the air; drop this one.
    if (token !== inFlight.current) return;

    setScanning(false);

    if (data.error) {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", text: data.error! }]);
      return;
    }

    const ids = (data.points ?? []).map((p) => p.id);
    setRecommended(ids);
    setSource(data.source ?? null);
    setFocusId(ids[0] ?? null);
    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        role: "assistant",
        text: [data.reply, data.note].filter(Boolean).join(" "),
        pointIds: ids,
      },
    ]);
  }, []);

  const select = useCallback((id: PointId) => {
    setSelectedId(id);
    setFocusId(id);
  }, []);

  const point = selectedId ? ACUPOINTS[selectedId] : null;
  // The screen pulse takes the colour of the point being pressed, so the
  // rhythm and the depth are the same signal rather than two competing ones.
  const pulse = point ? step(point.pressure) : null;

  return (
    <main
      className={`shell phase-${phase}`}
      style={
        pulse
          ? ({ "--pulse": pulse.color, "--pulse-glow": pulse.glow } as React.CSSProperties)
          : undefined
      }
    >
      {/* The screen pulse for the metronome. Behind everything, pointer-inert. */}
      <div className="pulse-veil" aria-hidden="true" />

      <ChatPanel
        messages={messages}
        scanning={scanning}
        source={source}
        aiConfigured={aiConfigured}
        onSubmit={(t) => void submit(t)}
        onPick={select}
      />

      <div className="stage">
        <Scene
          recommended={recommended}
          selectedId={selectedId}
          focusId={focusId}
          scanning={scanning}
          sex={sex}
          onSelect={select}
        />
        <fieldset className="body-switch">
          <legend className="sr-only">Body</legend>
          {(Object.keys(BUILD) as Sex[]).map((s) => (
            <label key={s} className={sex === s ? "is-on" : undefined}>
              <input
                type="radio"
                name="sex"
                value={s}
                checked={sex === s}
                onChange={() => setSex(s)}
              />
              {BUILD[s].label}
            </label>
          ))}
        </fieldset>

        {/* Sequential ramp: one hue, four lightness steps, ordered. */}
        <div className="legend" aria-label="Pressure depth scale">
          <p className="eyebrow">Pressure</p>
          <ul>
            {PRESSURE_ORDER.map((level) => (
              <li key={level}>
                <span
                  className="legend-dot"
                  style={{ background: PRESSURE[level].color }}
                  aria-hidden="true"
                />
                {PRESSURE[level].label}
              </li>
            ))}
          </ul>
        </div>

        <div className="stage-hint">
          {recommended.length === 0
            ? "Drag to orbit · scroll to zoom"
            : "Tap a red point for instructions"}
        </div>
        {focusId && (
          <button type="button" className="btn-ghost reset-view" onClick={() => setFocusId(null)}>
            Reset view
          </button>
        )}
      </div>

      <DetailsPanel point={point} onClose={() => setSelectedId(null)} onPhase={setPhase} />
    </main>
  );
}
