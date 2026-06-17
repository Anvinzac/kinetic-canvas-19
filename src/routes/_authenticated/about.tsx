import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  Film,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] pb-28">
      <header className="sticky top-0 z-30 glass flex items-center gap-3 border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="-ml-1 grid size-8 place-items-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-2xl tracking-wider">ABOUT</h1>
      </header>

      <main className="px-5 py-6">
        <section className="grid gap-5 sm:grid-cols-[1fr_220px] sm:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              kinetic canvas
            </p>
            <h2 className="mt-2 text-balance font-display text-4xl font-black leading-none">
              Words with motion, rhythm, and a little voltage.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Kinetic is a social canvas for short text posts that move like tiny posters. Every
              post stays in a clean 9:16 frame, so the work feels intentional on phones, tablets,
              and desktop screens.
            </p>
          </div>

          <div className="mx-auto aspect-[9/16] w-[min(70vw,220px)] overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#FF006E,#8338EC,#06FFA5)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">
                <span>9:16</span>
                <Sparkles className="size-4" />
              </div>
              <div className="text-center font-display text-5xl font-black leading-none text-white drop-shadow">
                TYPE
                <br />
                THAT
                <br />
                MOVES
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            what matters here
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Principle
              icon={<Type />}
              title="One thought at a time"
              text="Long captions become readable sentence pages instead of a word storm."
            />
            <Principle
              icon={<Film />}
              title="A fixed canvas"
              text="Posts keep a 9:16 frame everywhere, with no stretched tablet or desktop version."
            />
            <Principle
              icon={<MessageCircle />}
              title="Reactions in sequence"
              text="Comment chips drift through chronologically so the conversation has a pulse."
            />
            <Principle
              icon={<ShieldCheck />}
              title="Creator control"
              text="Settings favor quiet defaults, profile clarity, and predictable presentation."
            />
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-primary">
              <HeartHandshake className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold">Made for expressive posting</h3>
              <p className="text-sm text-muted-foreground">
                Fast enough for a passing thought, polished enough to feel like a little piece.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/create"
              className="rounded-xl bg-white px-3 py-2.5 text-center text-sm font-bold text-black transition hover:bg-white/90"
            >
              create
            </Link>
            <Link
              to="/feed"
              className="rounded-xl bg-white/10 px-3 py-2.5 text-center text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
            >
              feed
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Principle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <span className="grid size-9 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <h4 className="mt-3 font-display text-base font-bold">{title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
