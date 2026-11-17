# Video Mood Feed

Build a mobile-first Shorts-style video feed research app based on https://github.com/emilbakke/shorts-experiment-platform, but simplify it: do not include study-group assignment, fixed exposure periods, attention checks, post-study/debrief flows, or completion redirects. Enable Lovable Cloud first for user accounts, video storage, and saved data. Participants must sign in with a username. Show feed videos in a randomized order for each user. After 20 cumulative minutes of feed use, show a mandatory daily survey once per calendar day. Block returning to the feed until all questions are answered. Use 5-point Likert answers, 1 Not at all to 5 Very much, for: happy, optimistic, lively, tense, nervous, anxious (all phrased 'To what extent do you feel [word] right now?'). Save every response under the participant username with submitted timestamp. Include an admin-only analytics page showing a Survey responses table, with CSV export and sortable username and submitted_at columns. Also include a practical admin area for uploading/managing feed videos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cfa4efad-e327-41fc-8f88-041ba831dcc8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
