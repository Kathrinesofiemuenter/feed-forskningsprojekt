// One video element is reused for every feed item. Phones grant sound permission per
// element once a participant has touched the screen; reusing the same element keeps that
// permission for every following video, so sound never drops when swiping on.
let shared: HTMLVideoElement | null = null;

export function getSharedVideo(): HTMLVideoElement {
  if (shared) return shared;
  const el = document.createElement("video");
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.loop = true;
  el.preload = "auto";
  el.className = "h-full w-full object-cover";
  el.style.transform = "scale(1.09)";
  el.style.transformOrigin = "50% 100%";
  shared = el;
  return el;
}
