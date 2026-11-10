import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startFeedPlayback, updateFeedSound } from "@/lib/feed-playback";
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
  const holderRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const soundBlocked = useRef(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState(false);
  const userPaused = useRef(false);
  const soundTouch = useRef(0);
  const muteChoice = useRef(muted);
  muteChoice.current = muted;
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
    setPaused(false);
    userPaused.current = false;
    soundBlocked.current = false;
    let alive = true;
    let attempt = 0;
    let loadingRetries = 0;
    const ownsPlayer = () => alive && el.parentElement === holder;
    const start = async () => {
      if (!ownsPlayer() || userPaused.current || document.visibilityState === "hidden") return;
      const request = ++attempt;
      const ok = await startFeedPlayback(el, muteChoice.current);
      if (!ownsPlayer() || request !== attempt || userPaused.current) return;
      soundBlocked.current = !ok;
      setPaused(!ok);
    };
    const onPlay = () => setPaused(false);
    const onWaiting = () => setWaiting(true);
    const onReady = () => setReady(true);
    const onPlaying = () => { soundBlocked.current = false; setReady(true); setWaiting(false); setFailed(false); };
    const onCanPlay = () => { setWaiting(false); if (el.paused && !soundBlocked.current) void start(); };
    const onError = () => setFailed(true);
    const resume = () => { if (el.paused) void start(); };
    const restore = (event: Event) => {
      // Sound controls are commands, not play/pause gestures.
      if (event.target instanceof Element && event.target.closest("button, a")) return;
      if (!ownsPlayer() || userPaused.current || !soundBlocked.current) return;
      soundTouch.current = Date.now();
      void start();
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onError);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pointerdown", restore, true);
    window.addEventListener("touchend", restore, true);
    if (el.getAttribute("src") !== src) {
      el.src = src;
    } else if (el.readyState >= 2) {
      setReady(true);
    }
    void start();
    const watchdog = window.setInterval(() => {
      if (!ownsPlayer() || userPaused.current || document.visibilityState !== "visible" || el.readyState >= 2) return;
      if (loadingRetries >= 2) {
        setFailed(true);
        window.clearInterval(watchdog);
        return;
      }
      loadingRetries++;
      el.load();
      void start();
    }, 6000);
    return () => {
      alive = false;
      attempt++;
      window.clearInterval(watchdog);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pointerdown", restore, true);
      window.removeEventListener("touchend", restore, true);
      if (el.parentElement === holder) {
        el.pause();
        el.remove();
      }
    };
  }, [playing, src]);

  // A preference change never reloads the source or undoes a deliberate pause.
  useEffect(() => {
    if (!playing) return;
    const el = getSharedVideo();
    let cancelled = false;
    void updateFeedSound(el, muted, userPaused.current).then(ok => {
      if (cancelled) return;
      soundBlocked.current = !ok;
      if (!userPaused.current) setPaused(!ok);
    });
    return () => { cancelled = true; };
  }, [playing, muted]);

  function togglePlay() {
    if (!playing) return;
    if (Date.now() - soundTouch.current < 800) return;
    const el = getSharedVideo();
    if (el.paused) {
      userPaused.current = false;
      void startFeedPlayback(el, muteChoice.current).then(ok => {
        if (el.parentElement !== holderRef.current) return;
        soundBlocked.current = !ok;
        setPaused(!ok);
      });
    } else {
      el.pause();
      userPaused.current = true;
      setPaused(true);
    }
  }

  return (
    <section className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-background">
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
