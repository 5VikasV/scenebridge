# Product feedback and development friction

These notes separate observed development experience from items requiring live AWS validation. Update them after authenticating and rehearsing the actual submission.

## Fire TV / Android TV

- Built a native Kotlin/Compose TV experience with Media3, using Amazon's published native starter as a platform reference. No Google Play Services are required.
- D-pad focus, text entry, evidence replay and preserving the original pause are the important TV-specific flows.
- Initial environment had no Android SDK and did not expose KVM to ordinary restricted commands. Workspace-local tooling and an approved host build invocation made emulator boot feasible.
- Android lint caught an opt-in-only Media3 buffering API; the unnecessary call was removed and lint rerun rather than suppressed.
- An emulator first boot without an available ADB key resulted in unauthorized ADB access. Generating a workspace-local key, starting the server before boot, and resetting the newly created test AVD resolved it; test-only reset instructions are documented.
- Native emulator screenshots exposed clipped film metadata at 1080p. The video now takes the remaining available height so playback controls and the title fit the screen.
- Reviewing the native recording exposed player access on a background recomposer/test thread after network loading. Player setup and polling now explicitly use Android's main dispatcher, and the UI checks require actual replay playback and absence of a connection-error overlay.

## AWS

- Actual SDK calls are implemented for Polly, S3, Transcribe and Bedrock, with a separate deterministic offline mode.
- Initial authentication check failed because no credentials were available to the SDK. No successful live call should be claimed until the profile is configured and checked.
- Transcribe sentence boundaries are rebuilt from actual word timestamps; this avoids sending a sentence that continues beyond the paused position.
- Polly-generated files are selected explicitly so older offline narration cannot accidentally shadow cloud-generated audio.
- Bedrock logs are designed to capture request IDs, token usage and eligible evidence IDs for evaluation. Hallucination and answer quality require live model evaluation, beyond context filtering tests.

## Developer experience requests to validate

- A clear TV-emulator onboarding path, including virtualization and ADB authentication, would shorten first-run setup.
- Examples of time-bounded retrieval and evidence-linked TV answers would help developers build trustworthy viewing companions.
- After live AWS testing, add measured latency, transcription accuracy, access setup experience and specific actionable issues. Do not report hypothetical failures as observed product defects.
