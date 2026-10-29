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

## Post-conversion published-app retest — 29 October 2026, 18:17–18:34 UTC

The earlier preview-only notes above are historical. This retest targeted https://feed-forskningsprojekt.lovable.app after publication and conversion. Inventory confirmed 901 active MP4 paths. Two measured runs used 100 isolated Chromium contexts each, with real participant password login through the published UI. Temporary accounts were provisioned through the admin API; all participant actions used the app UI. A setup-only run aborted because of an ambiguous test selector and was cleaned before measurement.

### Playback run

Signed sources arrived, but the testing browser reported media error 4 and did not produce playable frames. This prevented subsequent survey/memo stages in that run. A separately downloaded sample returned HTTP 200, video/mp4, 3,932,444 bytes, H.264/AAC, 588×1280, 33.4 seconds; ffmpeg successfully decoded two seconds. That does not prove playback on phones, nor establish that the failure is exclusively the testing browser. Concurrent continuous playback remains unverified.

### Delivery and submission run

The second run measured signed-source arrival and full-file transfers independently of playback, then continued through the UI. After a short feed interval, only test accounts' usage totals were advanced to 1,195 seconds to reach the real daily threshold quickly. Four groups entered later stages 15 seconds apart, providing some overlapping activity, not an all-hours soak. Microphones used Chromium's synthetic input and successful recordings lasted approximately one minute.

| Measurement | Observed result |
|---|---|
| UI reached feed after password login | 96/100; median 38.46 s, p95 180.57 s, maximum 182.83 s |
| First signed source arrived | 95/100; median 3.32 s after feed entry, p95 10.67 s, maximum 44.03 s |
| Full MP4 transfers | 149/157 HTTP 200; median attempt latency 0.51 s, maximum 26.03 s; repeated samples are not unique participants or sustained playback |
| Survey UI submission and exact read-back | 95/100; all saved rows matched six values 4,3,2,4,3,3, username and populated timestamp |
| Daily usage read-back | 95 rows at or above 1,200 s, after intentional test-only threshold advancement |
| One-minute microphone recordings submitted, delivered indicator, file read-back | 51/100; all 51 files non-empty and saved duration at least 59 s |
| Published server-function requests | 587; zero HTTP errors recorded |
| Browser runtime exceptions | Zero recorded |
| Login throttling | 316 HTTP 429 responses across retries |
| Storage HTTP errors seen by browser | 11; direct transfer results above were counted separately |

Forty-nine contexts did not complete: four did not navigate to feed within the login timeout, one did not obtain its first source, and 44 reached the memo page but did not expose the stop-recording control within 30 seconds. A separate single-context check using one of those same accounts started recording successfully. The test did not isolate whether the 100-context microphone failures were app timing, browser resource/input constraints, or another cause. These must not be reported as 100 successful recordings or evidence of lost uploaded data.

**Conclusion:** This run does not certify reliable 100-participant end-to-end operation. Shared-IP login delays remain close to three minutes for some participants; transfers still encounter temporary failures; playback and concurrent microphone behavior need further diagnosis and real-device checks. Every successfully submitted survey and memo in this run was verified, but collection for all 100 was not demonstrated. No application changes, compute upgrade, or publication occurred during this retest. The existing 11 reliability/outbox tests passed.

### Cleanup

All 300 temporary accounts across the setup and two measured runs were removed. The submission run's 51 audio objects were deleted through storage API. Verified zero remaining test rows in profiles, roles, survey responses, voice memos, daily usage and video views, and zero files in their audio folders. Final account count returned to the original 78; real participant records were not targeted. Temporary diagnostic browser activity used these same temporary accounts and was included in cleanup.

## Additional published-app retest — 29 October 2026, approximately 19:13–19:25 UTC

Created 101 isolated temporary accounts: one preliminary full-flow check and 100 measured participants. Used ten independent Chromium processes, each with ten isolated contexts, microphone permission and a known non-silent WAV input. The preliminary login → survey → approximately one-minute recording → delivery flow passed. No app behavior changes or publication occurred.

### Measured run

| Measurement | Result |
|---|---|
| Password login reached feed | 100/100; median 82.06 s, p95 221.31 s, maximum 223.23 s; timing includes initial page loading |
| First signed source | 99/100; median 3.56 s after feed entry, p95 13.45 s, maximum 14.19 s among successful contexts; one timed out after 90 s |
| Full signed MP4 transfer | 99/99 attempted transfers HTTP 200; 372,769,233 bytes total |
| Initial survey submission and read-back | 99/100; all 99 exact six answers, usernames and timestamps verified |
| Concurrent one-minute recording UI | 99/100 started and submitted; measured elapsed median 62.04 s, maximum 63.63 s |
| Initial saved memo/file read-back | 98/100; all 98 had correct username, timestamp, duration at least 59 s and non-empty audio |
| UI delivered indicator | 99 contexts saw it, but one had no saved memo/object at read-back; indicator alone was not accepted as proof |
| Login throttling | 332 HTTP 429 responses |
| Browser-observed storage errors | Five |
| Published server-function HTTP errors / runtime exceptions | Zero / zero |

All 100 measured accounts were intentionally advanced to 1,195 daily seconds after the login/source stage, to exercise the real survey threshold without a 20-minute wait. This run has synchronized stages, not sustained continuous playback or an all-hours mixed-stage soak.

### Follow-up and limits

The missing-source account and the submitted-but-not-received memo account were revisited through ordinary password login and UI flows. The former completed its survey; both recorded and submitted new approximately one-minute memos. This follow-up waited for actual saved-row read-back rather than only the delivery indicator. Final verification: **100/100 surveys, 100/100 memos, 100/100 non-empty audio objects and 100/100 daily usage rows at or above 1,200 seconds**, with exact answer values 4,3,2,4,3,3 and matching usernames/timestamps.

The initially absent memo may reflect closing its context before asynchronous upload completed, a stale success indicator, or another delivery issue; this run did not isolate the cause. Follow-up re-recording is not evidence that its original queued blob automatically recovered.

Chromium explicitly returned an empty `canPlayType` for H.264 MP4 and `probably` for VP8 WebM. No playable MP4 frames were demonstrated. This establishes a limitation of this testing browser, not compatibility of every feed file on participant phones. Splitting recording capture across processes improved recording completion from the previous run, but synthetic capture is not proof of real-phone microphone reliability.

**Conclusion:** Better recording-stage completion, and all 100 datasets eventually collected and verified after two follow-ups; still not a clean 100/100 uninterrupted end-to-end pass. Shared-IP login delays exceeded three minutes for some accounts, one video-source failure occurred, initial memo receipt was incomplete, and actual concurrent playback remains unverified. Existing eleven reliability/outbox tests passed using Bun; Vitest cannot run these Bun-specific test files.

### Cleanup

Removed all 101 temporary accounts, their study rows and their audio objects. Verified zero temporary accounts and zero remaining rows in profiles, roles, survey responses, voice memos, feed usage and video views. The original 78 accounts remain and every original account ID was preserved. No real participant data was targeted.