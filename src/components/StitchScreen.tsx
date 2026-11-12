import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pocketwiseApi } from "@/lib/api";

const NAV_PATHS: Record<string, string> = {
  home: "/",
  account: "/auth",
  wallet: "/wallet",
  analysis: "/analysis",
  settings: "/settings",
};

// Text-based CTA routing for buttons the original design left as "#".
const CTA_PATHS: Array<[RegExp, string]> = [
  [/^get started free/i, "/auth"],
  [/sign out of pocketwise/i, "/"],
  [/permanently delete account/i, "/"],
];

type Props = { html: string; script: string; active: keyof typeof NAV_PATHS };

/**
 * Renders a Stitch screen's original markup and runs its original script,
 * so layout, spacing and interactions match the design exactly.
 */
export function StitchScreen({ html, script, active }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.innerHTML = html;
    const w = window as unknown as {
      __pwNavigate: (to: string) => void;
      __pwSupabase: unknown;
      __pwApi: typeof pocketwiseApi;
    };
    w.__pwNavigate = (to) => navigate({ to });
    w.__pwSupabase = supabase;
    w.__pwApi = pocketwiseApi;

    // Highlight the active bottom-nav item.
    root.querySelectorAll<HTMLAnchorElement>("nav a[data-path]").forEach((a) => {
      const isActive = a.dataset["path"] === active;
      a.classList.toggle("bg-primary", isActive);
      a.classList.toggle("text-on-primary", isActive);
      a.classList.toggle("shadow-sm", isActive);
      a.classList.toggle("text-on-surface-variant", !isActive);
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    if (script.trim()) {
      try {
        // Indirect eval: runs in global scope like the original <script> tag.
        (0, eval)(script);
      } catch (e) {
        console.error("Screen script failed", e);
      }
    }

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const navLink = target.closest<HTMLAnchorElement>("a[data-path]");
      if (navLink) {
        ev.preventDefault();
        const to = NAV_PATHS[navLink.dataset["path"] ?? ""];
        if (to) navigate({ to });
        return;
      }
      const el = target.closest<HTMLElement>("a,button");
      if (!el) return;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      for (const [re, to] of CTA_PATHS) {
        if (re.test(text.replace(/^[a-z_]+ /, ""))) {
          if (/delete/i.test(text)) {
            const input = root.querySelector<HTMLInputElement>("#delete-confirmation-input");
            if (input && (el as HTMLButtonElement).disabled) return;
          }
          setTimeout(() => navigate({ to }), /delete|sign out/i.test(text) ? 1200 : 0);
          return;
        }
      }
      if (el.tagName === "A" && el.getAttribute("href") === "#") ev.preventDefault();
    };
    root.addEventListener("click", onClick);
    window.scrollTo(0, 0);
    return () => root.removeEventListener("click", onClick);
  }, [html, script, active, navigate]);

  return (
    <div
      ref={ref}
      className="bg-surface font-body-md text-body-md text-on-surface min-h-screen relative"
    />
  );
}
