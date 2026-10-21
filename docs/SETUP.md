# Setup

## Media and server

Install Node 22 or later, a JDK 17 or later (tested with 21), Python and FFmpeg. If Pillow is unavailable, install it in a project-local environment:

```bash
python3 -m venv .local/render-env
. .local/render-env/bin/activate
python -m pip install -r requirements.txt
npm ci
npm run media:narrate
npm run dev
```

Keep the environment activated when running commands that render media. The renderer invokes `python3` from PATH. Narration is generated offline through the eSpeak-NG development dependency; AWS preparation explicitly selects Polly's separate MP3 files.

No `.env` is needed for offline mode. After making one from `.env.example`, keep `SCENEBRIDGE_MODE=fixture` until AWS content preparation succeeds.

## Android

The automated SDK installer and emulator launcher target **Linux x86_64**. On other operating systems, configure the appropriate Android SDK, emulator and Gradle 8.11.1 separately; the automated downloads in this repository are Linux binaries.

`npm run android:setup` downloads Android command-line tools, Gradle 8.11.1, API 35 build tools and an API 30 Android TV x86 image into `.local/`. It explicitly accepts the Android SDK package licences. An existing SDK can be selected using `ANDROID_SDK_ROOT`. You need approximately 7 GB free for tooling and caches, plus 2 GB RAM for the emulator. `.local` and `android/local.properties` are ignored.

```bash
npm run android:setup
npm run android:build
npm run android:emulator
```

The automated emulator is headless and uses software graphics with KVM CPU acceleration on Linux. If `/dev/kvm` is not exposed to your execution environment, run the emulator on the laptop host with virtualization enabled. The launcher attempts slower CPU emulation when KVM is absent, but usable performance is not guaranteed.

For a visible emulator window, use Android Studio's Device Manager, create an Android TV virtual device and start it, or run the workspace emulator without `-no-window`. Do not run two AVDs at once during the automated scripts: they expect one connected device.

Install and capture the first screenshot:

```bash
npm run build -- --android-verify
```

This waits for boot, installs the APK, starts SceneBridge and captures `artifacts/tv-home.png`. For workspace-managed ADB authentication trouble, `npm run build -- --emulator-restart` restarts **only this workspace's SceneBridge-TV emulator and wipes its test data**, including playback progress and installed apps. Reinstall the app afterward.

The `npm run build -- --android-setup`, `--android`, `--emulator`, `--android-verify` and `--android-test` forms are aliases for the same local tooling. The named `android:*` scripts work directly in an ordinary terminal.

Open `android/` in Android Studio to develop the native app. It uses Kotlin 2.1.20, AGP 8.9.2 and compatible pinned AndroidX libraries. There is no Google Play Services dependency. Local cleartext HTTP is permitted only in the debug APK. A release build needs an HTTPS backend, a supplied server URL and your own signing setup.

## Physical Fire TV

Enable ADB debugging on a Fire OS TV, connect with `adb connect DEVICE_IP:5555`, and install `artifacts/SceneBridge-debug.apk`. Start the backend on the laptop with `HOST=0.0.0.0`, then set the app's **Server** address to `http://LAPTOP_LAN_IP:3000`. Both devices must be on the same network. Vega devices need a separate Vega build; this APK targets Fire OS/Android TV.

## Browser tests

```bash
npm run build -- --browser-setup
npm run test:browser
```

Playwright downloads Chromium into `.local/playwright`. Tests start a local server if one is not already running. Run against fixture mode. The browser preview is for iteration and testing; record the native TV app for the Fire TV submission.
