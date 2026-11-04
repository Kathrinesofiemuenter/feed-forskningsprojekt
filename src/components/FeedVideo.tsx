import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startFeedPlayback } from "@/lib/feed-playback";

type Props = {
  src: string;
  title: string;
  index: number;
  total: number;
  muted: boolean;
  active: boolean;
  onToggleMute: () => void;
  near: boolean;
  eager?: boolean;
  onActive: (index: number) => void;
  onSkip: () => void;
};

export function FeedVideo({ src, title, index, total, muted, active, onToggleMute, near, eager, onActive, onSkip }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  // True when the browser blocked sound or autoplay and only a tap can unlock it.
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // A tap that already (re)started playback must not also toggle it back to paused.
  const skipToggleUntil = useRef(0);

  useEffect(() => {
    setFailed(false);
    setWaiting(false);
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!src || !active || !near) {
      el.pause();
      return;
    }
    let cancelled = false;
    void startFeedPlayback(el, muted).then(playing => {
      if (cancelled) return;
      setNeedsTap(!playing);
      setPaused(!playing);
    });
    return () => { cancelled = true; };
  }, [src, active, near, muted]);

  // If the browser forced this video silent, restore sound on the participant's
  // next touch or swipe anywhere, instead of leaving it muted.
  useEffect(() => {
    if (!needsTap || muted || !active) return;
    const restore = () => {
      const el = ref.current;
      if (!el) return;
      skipToggleUntil.current = Date.now() + 700;
      void startFeedPlayback(el, muted).then(playing => { setNeedsTap(!playing); setPaused(!playing); });
    };
    window.addEventListener("touchend", restore, true);
    window.addEventListener("click", restore, true);
    return () => {
      window.removeEventListener("touchend", restore, true);
      window.removeEventListener("click", restore, true);
    };
  }, [needsTap, muted, active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = (entry?.intersectionRatio ?? 0) > 0.6;
        if (visible) onActive(index);
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onActive]);

  function unlockSound() {
    const el = ref.current;
    if (!el) return;
    skipToggleUntil.current = Date.now() + 700;
    void startFeedPlayback(el, muted).then(playing => { setNeedsTap(!playing); setPaused(!playing); });
  }

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (Date.now() < skipToggleUntil.current) return;
    if (needsTap) { unlockSound(); return; }
    if (el.paused) {
      el.play()
        .then(() => setPaused(false))
        .catch(() => undefined);
    } else {
      el.pause();
      setPaused(true);
    }
  }

  return (
    <section className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-background">
      {/* Screen recordings carry the phone's status bar (clock, battery). Scaling up from
          the bottom edge pushes that top strip out of view, cropping it for the viewer. */}
      <video
        ref={ref}
        src={near && src ? src : undefined}
        className="h-full w-full object-cover"
        style={{ transform: "scale(1.09)", transformOrigin: "50% 100%" }}
        loop
        playsInline
        muted={muted}
        preload={near ? "auto" : "none"}
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => { setWaiting(false); setFailed(false); }}
        onCanPlay={() => setWaiting(false)}
        onError={() => { if (src && near) setFailed(true); }}
      />
      {active && (!src || waiting) && !failed && <Loader2 aria-label="Indlæser video" className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />}
      {failed && active && <Button variant="secondary" size="icon" onClick={onSkip} aria-label="Næste video" title="Næste video" className="absolute inset-0 m-auto size-14"><SkipForward /></Button>}
      {paused && active && !needsTap && !failed && src && (
        <Button variant="ghost"
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto flex size-24 items-center justify-center rounded-full bg-foreground/15 backdrop-blur-sm"
        >
          <Play className="size-10 fill-current text-foreground" />
        </Button>
      )}
      {needsTap && active && (
        <Button variant="ghost"
          type="button"
          onClick={unlockSound}
          className="absolute left-1/2 top-[max(1.5rem,env(safe-area-inset-top))] z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground/15 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-md"
        >
          <VolumeX className="size-4" /> Tryk for lyd
        </Button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/60 to-transparent px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28" />

      <Button variant="ghost"
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-28 right-4 flex size-14 items-center justify-center rounded-full bg-foreground/10 text-foreground backdrop-blur-md transition-transform active:scale-90"
      >
        {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
      </Button>
    </section>
  );
}
