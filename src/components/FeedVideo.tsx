import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startFeedPlayback } from "@/lib/feed-playback";
import { getSharedVideo } from "@/lib/shared-player";

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

export function FeedVideo({ src, index, muted, active, onToggleMute, near, onActive, onSkip }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState(false);
  const userPaused = useRef(false);
  const soundTouch = useRef(0);
  const playing = active && near && !!src;

  // Attach the shared player to this slide while it is the active one.
  useEffect(() => {
    if (!playing) return;
    const el = getSharedVideo();
    const holder = holderRef.current;
    if (!holder) return;
    if (el.parentElement !== holder) holder.appendChild(el);
    setFailed(false);
    setWaiting(false);
    setReady(false);
    userPaused.current = false;
    const onPlay = () => setPaused(false);
    const onWaiting = () => setWaiting(true);
    const onReady = () => setReady(true);
    const onPlaying = () => { setReady(true); setWaiting(false); setFailed(false); };
    const onCanPlay = () => setWaiting(false);
    const onError = () => setFailed(true);
    el.addEventListener("play", onPlay);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onError);
    if (el.getAttribute("src") !== src) {
      el.src = src;
    } else if (el.readyState >= 2) {
      setReady(true);
    }
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onError);
      el.pause();
    };
  }, [playing, src]);

  // Start playback; keep the participant's mute choice in sync.
  useEffect(() => {
    if (!playing) return;
    const el = getSharedVideo();
    let cancelled = false;
    void startFeedPlayback(el, muted).then(ok => {
      if (cancelled) return;
      if (ok) { setSoundBlocked(false); setPaused(false); return; }
      if (muted) { setPaused(true); return; }
      // Phone refused sound before any touch: play silently and restore sound on first touch.
      el.muted = true;
      el.play()
        .then(() => { if (!cancelled) { setSoundBlocked(true); setPaused(false); } })
        .catch(() => { if (!cancelled) setPaused(true); });
    });
    return () => { cancelled = true; };
  }, [playing, src, muted]);

  // Any touch restores sound on the shared player — this also unlocks it for all next videos.
  useEffect(() => {
    if (!playing || muted) return;
    const restore = () => {
      const el = getSharedVideo();
      if (!el.muted) return;
      el.muted = false;
      void el.play().catch(() => undefined);
      setSoundBlocked(false);
      // This touch only turned sound on; it must not also pause the video.
      soundTouch.current = Date.now();
    };
    window.addEventListener("pointerdown", restore, true);
    window.addEventListener("touchstart", restore, true);
    window.addEventListener("touchend", restore, true);
    return () => {
      window.removeEventListener("pointerdown", restore, true);
      window.removeEventListener("touchstart", restore, true);
      window.removeEventListener("touchend", restore, true);
    };
  }, [playing, muted, soundBlocked]);

  // Resume when returning to the app, never trading sound for silence.
  useEffect(() => {
    if (!playing) return;
    const resume = () => {
      const el = getSharedVideo();
      if (document.visibilityState !== "visible" || userPaused.current || !el.paused) return;
      void startFeedPlayback(el, muted).then(ok => {
        if (ok || muted) return;
        el.muted = true;
        void el.play().then(() => setSoundBlocked(true)).catch(() => setPaused(true));
      });
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [playing, muted]);

  // Watchdog: reload if no picture after a few seconds.
  useEffect(() => {
    if (!playing || ready) return;
    let tries = 0;
    const t = setInterval(() => {
      const el = getSharedVideo();
      if (el.readyState >= 2 || tries >= 2) return;
      tries++;
      el.load();
      void startFeedPlayback(el, muted);
    }, 6000);
    return () => clearInterval(t);
  }, [playing, ready, muted]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if ((entry?.intersectionRatio ?? 0) > 0.6) onActive(index); },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onActive]);

  function togglePlay() {
    if (!playing) return;
    if (Date.now() - soundTouch.current < 800) return;
    const el = getSharedVideo();
    if (el.paused) {
      el.play().then(() => { userPaused.current = false; setPaused(false); }).catch(() => undefined);
    } else {
      el.pause();
      userPaused.current = true;
      setPaused(true);
    }
  }

  return (
    <section ref={sectionRef} className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-background">
      <div ref={holderRef} className="absolute inset-0" onClick={togglePlay} />
      {/* Warm the next video's file without playing it. */}
      {!active && near && src && (
        <video src={src} muted preload="auto" playsInline className="hidden" aria-hidden />
      )}
      {active && (!src || waiting || !ready) && !failed && !paused && <Loader2 aria-label="Indlæser video" className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground" />}
      {failed && active && <Button variant="secondary" size="icon" onClick={onSkip} aria-label="Næste video" title="Næste video" className="absolute inset-0 m-auto size-14"><SkipForward /></Button>}
      {paused && active && !failed && src && (
        <Button variant="ghost" type="button" onClick={togglePlay} aria-label="Play"
          className="absolute inset-0 m-auto flex size-24 items-center justify-center rounded-full bg-foreground/15 backdrop-blur-sm">
          <Play className="size-10 fill-current text-foreground" />
        </Button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/60 to-transparent px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28" />
      <Button variant="ghost" type="button" onPointerDown={e => e.stopPropagation()} onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-28 right-4 flex size-14 items-center justify-center rounded-full bg-foreground/10 text-foreground backdrop-blur-md transition-transform active:scale-90">
        {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
      </Button>
    </section>
  );
}
