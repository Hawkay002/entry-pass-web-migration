// components/layout/atmosphere.tsx — fixed ambient layer behind the page.
// Three large, blurred gradient orbs drift slowly. Sits above Starfield,
// below all content. Pointer-events: none. Motion is forced via globals.css
// so it survives prefers-reduced-motion (landing is motion-led by design).

export function Atmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="orb-drift-1 absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,0.35), transparent 70%)",
          willChange: "transform",
        }}
      />
      <div
        className="orb-drift-2 absolute -right-48 top-1/3 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.28), transparent 70%)",
          willChange: "transform",
        }}
      />
      <div
        className="orb-drift-3 absolute -bottom-40 left-1/4 h-[800px] w-[800px] rounded-full opacity-55 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.30), transparent 70%)",
          willChange: "transform",
        }}
      />
    </div>
  );
}