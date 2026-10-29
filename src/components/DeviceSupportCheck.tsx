import { useEffect, useState } from "react";

function isSupported(): boolean {
  if (typeof window === "undefined") return true;
  const w = window as unknown as Record<string, unknown>;
  const hasRecorder = typeof w["MediaRecorder"] !== "undefined";
  const hasMic = !!navigator.mediaDevices?.getUserMedia;
  const hasStorage = (() => {
    try {
      localStorage.setItem("__t", "1");
      localStorage.removeItem("__t");
      return true;
    } catch {
      return false;
    }
  })();
  const hasModernJs = typeof Promise !== "undefined" && typeof fetch !== "undefined";
  return hasRecorder && hasMic && hasStorage && hasModernJs;
}

export function DeviceSupportCheck() {
  const [unsupported, setUnsupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setUnsupported(!isSupported());
  }, []);

  if (!unsupported || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-6">
      <div className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center text-card-foreground">
        <h2 className="text-xl font-bold">Din telefon understøttes ikke</h2>
        <p className="text-sm text-muted-foreground">
          Din telefon eller browser er for gammel til at optage stemmebeskeder i appen. Opdater telefonen, eller kontakt projektets ansvarlige.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          Fortsæt alligevel
        </button>
      </div>
    </div>
  );
}
