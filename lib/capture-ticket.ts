// lib/capture-ticket.ts — capture a live, mounted ticket element (including
// its WebGL shader) as a landscape JPEG data URL. Used for OG share previews.
//
// CRITICAL: this captures the ORIGINAL DOM node, not a clone. The ticket's
// holographic surface is a WebGL2 <canvas> — cloneNode(true) does not copy a
// WebGL canvas's drawing context, so a cloned capture renders black. We must
// capture the live, mounted element. (Same lesson as interactive-ticket's
// DownloadButton and the "capture original element" commit 1223fb1.)
//
// Fire-and-forget by design: returns null on ANY failure so callers can treat
// a missing OG snapshot as a non-fatal degradation (SVG fallback).

interface CaptureOptions {
  /** JPEG quality 0–1. Default 0.85 (~80–150KB, well under the 1MB doc limit). */
  quality?: number;
  /** Pixel ratio for the source PNG. Default 2 (~1200px+ for a ~600px card). */
  pixelRatio?: number;
  /** Extra warmup delay (ms) after fonts+rAF, to let the shader draw. Default 600. */
  warmupMs?: number;
}

export async function captureTicketAsJpeg(
  element: HTMLElement,
  { quality = 0.85, pixelRatio = 2, warmupMs = 600 }: CaptureOptions = {}
): Promise<string | null> {
  try {
    const { toPng } = await import("html-to-image");

    // Flatten any tilt/perspective transform on the element so the capture is
    // a clean, upright snapshot. Restore it afterwards.
    const prevTransform = element.style.transform;
    element.style.transform = "none";

    // Wait for web fonts (The Seasons, Gotham Nights) so text doesn't fall
    // back to a system face and shift the layout mid-capture.
    if (document.fonts) await document.fonts.ready;

    // Two RAFs = one paint cycle after the layout settles.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );

    // WebGL needs a beat after the first paint to actually draw a frame.
    if (warmupMs > 0) await new Promise((r) => setTimeout(r, warmupMs));

    const pngDataUrl = await toPng(element, {
      pixelRatio,
      backgroundColor: "#000000",
      cacheBust: true,
      style: { transform: "none" },
    });

    element.style.transform = prevTransform;

    // Re-encode PNG → JPEG via an offscreen canvas for a much smaller payload.
    const img = new Image();
    img.src = pngDataUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL("image/jpeg", quality);
  } catch (err) {
    // Best-effort: never throw. Caller falls back to the SVG OG route.
    console.warn("[capture-ticket] capture failed:", err);
    return null;
  }
}
