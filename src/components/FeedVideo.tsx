import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";

type Props = {
  src: string;
  title: string;
  index: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
  near: boolean;
  onActive: (index: number) => void;
};

export function FeedVideo({ src, title, index, total, muted, onToggleMute, near, onActive }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = (entry?.intersectionRatio ?? 0) > 0.6;
        setActive(visible);
        if (visible) onActive(index);
        if (visible) {
          el.play().catch(() => {
            // Autoplay with sound can be blocked: retry silently, sound returns on tap.
            el.muted = true;
            el.play().catch(() => setPaused(true));
          });
        } else {
          el.pause();
          el.currentTime = 0;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onActive]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    if (!muted && active && el.paused) el.play().catch(() => undefined);
  }, [muted, active]);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
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
        src={near ? src : undefined}
        className="h-full w-full object-cover"
        style={{ transform: "scale(1.09)", transformOrigin: "50% 100%" }}
        loop
        playsInline
        muted={muted}
        preload={near ? "auto" : "none"}
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
      />
      {paused && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto flex size-24 items-center justify-center rounded-full bg-foreground/15 backdrop-blur-sm"
        >
          <Play className="size-10 fill-current text-foreground" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/60 to-transparent px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28" />

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-28 right-4 flex size-14 items-center justify-center rounded-full bg-foreground/10 text-foreground backdrop-blur-md transition-transform active:scale-90"
      >
        {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
      </button>
    </section>
  );
}
