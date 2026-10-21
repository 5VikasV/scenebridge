# Uploading SceneBridge to GitHub

## Source files

For a browser upload, extract `artifacts/SceneBridge-github-source.zip`. Upload the **contents** of the extracted `SceneBridge` folder to your repository, including `.gitignore` and `.env.example`. The archive contains the source, original story, tests, documentation, licence and README screenshot. It excludes credentials, local tools, generated media, builds and release binaries.

If using Git from a normal checkout, the existing `.gitignore` excludes local `.env` files, `.aws/`, workspace configuration, `.local/`, `node_modules/`, build output and signing keys. Review the staged file list before committing. Browser uploads do not apply your local `.gitignore`, which is why the separate source archive is provided.

Commit `package-lock.json`, `requirements.txt`, `LICENSE` and `THIRD_PARTY_NOTICES.md` along with the application source. Keep `.env.example` as the public template; the real `.env` stays on your machine. Offline mode requires no AWS account or keys.

## Release assets

Upload these separately as GitHub Release assets:

- `SceneBridge-debug.apk` — installable native TV demo; it connects to the local backend described in the README.
- `SceneBridge-offline-demo.zip` — source, APK, generated mystery, captions, walkthrough and screenshots.
- `SceneBridge-offline-walkthrough.mp4` — silent native emulator walkthrough.

The source archive recreates the mystery with `npm run media:narrate`; the complete demo archive already includes the generated media. Creating a GitHub repository does not host the backend or turn localhost into a public demo URL.

## Description and links

Suggested repository description:

> A Fire TV viewing companion with playback-bounded transcript answers and replayable evidence. Native Kotlin app, TypeScript backend and an offline demo.

Use the repository's actual URL in the submission's source/try-it-out field. Upload the walkthrough with your explanation to YouTube or Vimeo for the video field. Describe the current demo as offline; AWS integrations are present in source but disabled and not yet verified live.
