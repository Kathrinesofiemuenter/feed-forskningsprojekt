# Roadmap

- [x] Change the app color scheme to TikTok-inspired black, white, red, and cyan.
- [x] Remove social-action controls from uploaded videos while retaining playback and sound controls.
- [x] Cap each video at two showings per participant, never back-to-back.
- [x] Stop visitors without an account from opening stored video files.
- [x] Participants can only view videos via temporary server-issued links (no direct file access)
- [x] Translate the daily check-in to Danish (glad, tilfreds, håbefuld, bekymret, ensom, irritabel) and change the scale to 0–5.
- [x] Change the check-in scale to five buttons, 1–5, one choice per feeling.
- [x] Apply the revised Danish front-page wording, make 5 read "I meget høj grad", and give the feed points icon bubbles like the check-in cards.
- [x] Auto-retry logins so a whole room on one Wi-Fi signing in at once still gets in.
- [x] Test 100 concurrent login/feed requests, survey submissions, and voice memo uploads; verify saved data and clean temporary test records. Capacity failures and playback limits documented in load-test-report.md; no claim of 100-device readiness.
- [x] Load only nearby video links and offer a next-video control on playback errors without preparing the entire feed.
- [x] Extend and spread out temporary login retries.
- [x] Save survey/memo locally before sending, retry temporary refusals, and show delivery status.
- [x] Verify improvements with 11 tests and a real survey/recording flow including an injected 429; assess video compatibility separately without replacing originals. Sample is H.264/AAC MOV; bulk conversion and published 100-user retest are not performed.
