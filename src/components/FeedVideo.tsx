import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";

type Props = {
  src: string;
  title: string;
  index: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
};

export function FeedVideo({ src, title, index, total, muted, onToggleMute }: Props) {
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
        if (visible) {
          el.play().catch(() => setPaused(true));
        } else {
          el.pause();
          el.currentTime = 0;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPaused(false)).catch(() => undefined);
    } else {
      el.pause();
      setPaused(true);
    }
  }

  return (
    <section className="relative h-dvh w-full snap-start snap-always bg-black">
      <video
        ref={ref}
        src={src}
        className="h-full w-full object-cover"
        loop
        playsInline
        muted={muted}
        preload={active ? "auto" : "metadata"}
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
      />
      {paused && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-background/60 backdrop-blur"
        >
          <Play className="size-9 fill-current text-foreground" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-8 pt-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {index + 1} / {total}
        </p>
        <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-8 right-4 flex size-12 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </section>
  );
}
