# Demo and submission

## Recording outline (under three minutes)

1. **0:00–0:15:** Show SceneBridge running on the TV emulator, the original mystery and the mode indicator. State: “When you miss a scene, getting an explanation shouldn't spoil the next one.”
2. **0:15–0:35:** Play a few seconds, pause and select **Recap last minute**. Explain that the server only supplies completed earlier passages.
3. **0:35–1:05:** Seek to approximately **01:35** and ask **“Why did Mira hide the key?”**. Show the insufficient-context result.
4. **1:05–1:35:** Move to **02:36** and ask the same question. Show the supported explanation and evidence card. With a generated AWS transcript, verify the actual reveal's ending timestamp beforehand.
5. **1:35–2:00:** Select evidence, replay the earlier moment and choose **Back to the story**. Point out that playback returns to the original pause.
6. **2:00–2:25:** Rewind and ask again. The later explanation must no longer appear. Briefly show the actual Bedrock request's passage boundary/ID log when demonstrating AWS.
7. **2:25–2:45:** Explain the architecture: original Polly-narrated film in S3, timestamped by Transcribe, bounded context sent to Bedrock. End with the audience: viewers catching up without losing their place.

Fixture mode is useful for rehearsal, but label it clearly and record a real AWS call for the AWS Builder story. Do not claim the illustrative video is live-action or the app works inside other streaming services.

## Capture the native app

With the fixture backend and emulator running, `npm run build -- --android-record` records a short automated native walkthrough and captures before/after-reveal and evidence-replay screenshots. It runs the real native interaction check with reading pauses, saves `artifacts/SceneBridge-offline-walkthrough.mp4`, and preserves the **OFFLINE FIXTURE** label. This is a silent rehearsal recording; add your own narration and a live AWS demonstration before using it for an AWS Builder submission.

The emulator's ADB path is `.local/android-sdk/platform-tools/adb`. With the same workspace ADB environment as `scripts/android-tools.py`, use `adb shell screenrecord --time-limit 165 /sdcard/scenebridge-demo.mp4`, perform the flow, then `adb pull /sdcard/scenebridge-demo.mp4 artifacts/`. Screen recordings do not include narration audio automatically; add your spoken explanation when editing. Do not use a browser-only recording for Fire TV.

## Submission materials

- Primary track: **Fire TV**. Mini-challenge: **AWS Builder**, after live AWS verification.
- GitHub source repository with original media source, MIT licence, dependency notices and complete setup instructions. Include generated media as release assets or ensure the documented renderer runs reproducibly.
- Installable debug APK as a release asset for judging. Explain how to connect it to the locally runnable backend.
- A publicly visible YouTube or Vimeo demo under three minutes, with actual native TV/emulator footage.
- Project description, screenshots, AWS architecture and product feedback for tools actually used.
- If the repo is private, grant the current reviewers listed by the hackathon access. Publishing a repo, uploading a video and submitting Devpost remain separate actions.
- Ensure judges can reproduce the app through the end of judging. Offline mode demonstrates mechanics; AWS mode requires their own configured account or a separately arranged evaluation environment.

## Suggested description

SceneBridge is a viewing companion designed for Fire TV and demonstrated in an Android TV emulator. Pause an original mystery, ask what you missed or why something happened, and receive context supported by earlier-scene evidence. A server-side playback boundary excludes unfinished and future transcript passages before answering. Evidence replay returns you to your original paused position, and rewinding starts a fresh context. The current demo uses labelled offline transcript extraction. Optional AWS adapters implement narration, transcription, private media storage and model-generated answers; live AWS operation remains unverified.
