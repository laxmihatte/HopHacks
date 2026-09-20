"use client";

import { useEffect, useState } from "react";

/**
 * The stage placeholder, with a way out.
 *
 * A dynamic import that fails — a stale or wiped `.next` cache, a chunk 404
 * after a rebuild, a blocked script — leaves React showing the loading state
 * forever with no error anywhere the user can see. On a laptop mid-demo that
 * looks exactly like a hung app. After a few seconds this says what is wrong
 * and offers the one action that fixes it.
 */
export default function StageLoader() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Comfortably longer than a cold compile of the 3D chunk on a slow laptop.
    const t = setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="scene-loading" role="status" aria-live="polite">
      {slow ? (
        <>
          <p>The 3D scene did not load.</p>
          <p className="scene-loading-hint">
            This usually means the dev server was rebuilt while the page was
            open, so its script chunks no longer match.
          </p>
          <button type="button" className="btn-primary" onClick={() => location.reload()}>
            Reload the page
          </button>
        </>
      ) : (
        <p>Preparing model…</p>
      )}
    </div>
  );
}
