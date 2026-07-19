/**
 * Unauthenticated splash / sign-in page (`/auth`).
 *
 * Exports: AuthPage
 * Depends on: supabase, lovable OAuth, ensureProfile, demo-session, framer-motion, sonner
 */

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureProfile } from "@/lib/social.functions";
import { toast } from "sonner";
import { endDemoSession, isDemoSession, startDemoSession } from "../demo-session";

/**
 * @responsibility Offer Google OAuth or demo session entry, redirecting when already signed in.
 * @returns Auth splash with aurora branding and CTA buttons
 */
export function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const ensureFn = useServerFn(ensureProfile);

  useEffect(() => {
    if (isDemoSession()) {
      navigate({ to: "/feed" });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/feed" });
    });
  }, [navigate]);

  async function handleGoogle() {
    setLoading("google");
    endDemoSession();
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error("Google sign-in failed");
      setLoading(null);
      return;
    }
    if (res.redirected) return;
    await ensureFn();
    navigate({ to: "/feed" });
  }

  async function handleDemo() {
    setLoading("demo");
    try {
      endDemoSession();
      startDemoSession();
      toast.success("welcome, demo creator");
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(null);
    }
  }

  const words = ["MOVE.", "TYPE.", "FLY.", "LOUD.", "PULSE."];

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-hidden bg-background px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))]">
      {/* aurora bg */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-32 top-10 size-[420px] rounded-full bg-[var(--color-magenta)] blur-[120px]" />
        <div className="absolute -right-32 top-1/3 size-[380px] rounded-full bg-[var(--color-cyber)] blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 size-[460px] -translate-x-1/2 rounded-full bg-[var(--color-electric)] blur-[140px]" />
      </div>

      <header className="relative z-10 mt-4 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          kinetic · social
        </p>
        <h1 className="font-display mt-2 text-[44px] font-black leading-[0.95] tracking-tight">
          words that
        </h1>
        <div className="relative h-[60px] overflow-hidden font-impact text-[clamp(2.25rem,14vw,3.625rem)] leading-none text-primary">
          {words.map((w, i) => (
            <motion.span
              key={w}
              className="absolute inset-x-0 text-center"
              animate={{ y: ["100%", "0%", "0%", "-100%"] }}
              transition={{
                duration: words.length * 1.4,
                times: [0, 0.1, 0.2, 0.3],
                delay: i * 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {w}
            </motion.span>
          ))}
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 my-8"
      >
        <div
          className="grad-aurora flex size-44 items-center justify-center rounded-[40%] shadow-[var(--shadow-glow)]"
          style={{ animation: "kinetic-float 4s ease-in-out infinite" }}
        >
          <span className="font-impact text-7xl text-white drop-shadow-2xl">K</span>
        </div>
      </motion.div>

      <div className="relative z-10 w-full max-w-sm space-y-3">
        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-medium text-black transition active:scale-[0.98] disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7A19.9 19.9 0 0 0 24 4a20 20 0 1 0 19.6 16.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7A19.9 19.9 0 0 0 24 4a20 20 0 0 0-17.7 10.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3a12 12 0 0 1-18-6.3L6.7 32.5A20 20 0 0 0 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.3 5.3c-.4.4 6.7-4.8 6.7-14.8 0-1.3-.1-2.6-.4-3.5z"
            />
          </svg>
          {loading === "google" ? "opening google…" : "continue with google"}
        </button>

        <button
          onClick={handleDemo}
          disabled={loading !== null}
          className="grad-aurora flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 font-bold text-white shadow-[var(--shadow-glow)] transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading === "demo" ? "opening demo…" : "✨ try as demo account"}
        </button>

        <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          one tap · no signup
        </p>
      </div>
    </div>
  );
}
