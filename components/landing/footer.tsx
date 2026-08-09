// components/landing/Footer.tsx — glass footer, Outfit wordmark.

import { NAV_LINKS } from "./data";

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 py-14">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-10 border-b border-white/8 pb-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-success-green" />
              <span className="text-xl font-light tracking-tight text-foreground">
                Ticketing<span className="font-semibold">System</span>.
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Real-time ticketing and gate entry management for events that
              don't get second chances.
            </p>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">Platform</span>
            <ul className="mt-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-xs text-muted-foreground">Built for</span>
            <ul className="mt-4 space-y-3">
              <li className="text-sm text-foreground/80">Weddings</li>
              <li className="text-sm text-foreground/80">Galas & Celebrations</li>
              <li className="text-sm text-foreground/80">Corporate Events</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 md:flex-row">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EntryPass. Gate entry, under control.
          </span>
          <a
            href="#top"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
