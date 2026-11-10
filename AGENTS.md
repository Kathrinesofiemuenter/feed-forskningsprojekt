<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep feed ordering separate from URL delivery; sign only a small moving window and mount media only near the active item to bound per-participant storage requests and memory.
- Reuse unexpired signed media links across overlapping feed windows and centralize automatic playback; changing a buffered source or seeking during visibility changes causes startup restarts.
- Persist survey and memo submissions to the device outbox before network delivery; commit IndexedDB transactions before navigating, scope sync to the signed-in user, and back off temporary failures without discarding payloads.
- Use the shared reliability policy for login and delivery retries so concurrent participants spread requests over time rather than retrying in synchronized bursts.
- Route-selected feed index controls active playback; use the shared playback helper without silently muting or playing neighboring elements, so sound follows explicit participant preference.
- Give the active slide sole ownership of shared-player events and recovery; invalidate pending playback callbacks on cleanup and preserve deliberate pause when changing sound, so stale slides cannot interrupt the next video.
