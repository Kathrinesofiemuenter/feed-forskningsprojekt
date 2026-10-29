# 100-participant load test — 29 October 2026

## Scope

100 isolated temporary participant accounts against the shared Lovable Cloud backend. Login, data operations, and storage requests used real participant credentials and authorization rules. Feed URL signing exercised the local preview server, not the published worker. Stages were synchronized separately; this was not a sustained 100-device or mixed-stage soak test. A single Chromium browser exercised the actual survey → microphone recording → submission → feed flow with synthetic audio.

## Results

| Stage | Result | Notes |
|---|---|---|
| Concurrent login, one source IP | 60/100 initially; 80/100 after the app's three automatic retries | Remaining 20 hit HTTP 429. Later ordinary password retries authenticated all 100. |
| Full feed listing/status/signing, 901 videos | 27/100 | 73 server-function signing errors. Successful loads had median 117 seconds and p95 177 seconds in the local preview. |
| First 1 MiB video transfer | 26/27 available signed sources | One HTTP 429. Median 0.54 seconds, p95 2.06 seconds. Does not establish 100 concurrent continuous playback. |
| Watch-time writes | 100/100 | Four consecutive 15-second increments per account; exact 60-second totals verified. Stage p95 34.8 seconds, following heavy signing traffic. |
| Survey insert and read-back | 100/100 | Exact six answer values, username, and one response per user verified; p95 1.93 seconds. |
| Concurrent one-minute audio upload and memo insert | 86/100 immediately | 14 HTTP 429 uploads. Explicit later retries saved the remaining 14. Initial successful stage p95 5.03 seconds. |
| Saved memo verification | 100/100 eventually | All files retrieved as non-empty recordings with reduced download concurrency. Bulk simultaneous verification also encountered throttling. |
| Cross-user survey access | 100/100 denied | Participants could not read another test participant's answers. |
| Real browser flow | Passed | Six answers, non-silent six-second microphone recording, submission, and return to feed. No browser runtime errors. |

## Limits and findings

- This run does **not** certify readiness for 100 simultaneous participants, continuous playback, real-phone microphone behavior, weak Wi-Fi, or all-hours operation.
- Browser feed playback was black in the sampled Chromium run; the sampled MOV source reported media error 4. Playback compatibility remains unverified on participants' phones.
- Login and storage throttling occurred from one source IP. The remaining audio uploads required explicit test-script retries; these are not evidence that the app automatically recovers from HTTP 429.
- Full-feed signing requests fan out over all 901 videos before returning the feed. This creates substantial work during synchronized starts; staged/lazy signing and bounded parallelism should be evaluated before repeating the test.
- Backend reported 194–195 of 200 pooled clients in use during/after load, versus 1 before it. No restarts or resource-exhaustion alerts. Larger Lovable Cloud compute may help concurrent backend work, but will not by itself remove shared-IP login/storage limits or video compatibility problems.
- Repeat a published-worker load test and sustained mixed-stage test after capacity fixes. This run made no app behavior changes and did not publish.

## Cleanup

Deleted and verified removal of all 100 temporary accounts, their profiles/roles, feed usage, survey answers, memo records, watched-video rows, and 101 test audio objects. Real participant accounts and study data were not included in cleanup.

## Follow-up reliability changes

- Feed now signs four nearby videos, verified in Chromium, rather than waiting on all 901. Only three video elements mounted initially, four after advancing one item; the full randomized ordered list remains intact.
- Login retries now use seven spaced waits totaling 156 seconds before jitter. Wrong passwords still do not retry.
- Survey and audio payloads commit locally before navigation. Temporary failures including HTTP 429 and 5xx remain queued with backoff. Status distinguishes queued and delivered payloads. Original submission timestamp is retained.
- Eleven automated tests passed. A real participant browser flow completed six survey answers, recorded non-silent audio, received a simulated upload 429, retried automatically, and showed delivered status without runtime errors. The temporary verification account and audio were removed.
- A sampled failing original is 46.7 MB, 18.46 seconds, H.264/AAC in MOV at 1180×2556. Its original file was not replaced; phone playback and broader transcoding remain unverified.
- These changes are preview-only. No published-worker 100-user retest or compute upgrade has been performed, and the original capacity findings are not superseded by the smaller verification run.