#!/usr/bin/env python3
"""Package reviewable source and offline assets, excluding tooling and credentials."""
from pathlib import Path
import hashlib, json, zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'
OUT.mkdir(exist_ok=True)
files=[]
for name in ('README.md','LICENSE','THIRD_PARTY_NOTICES.md','requirements.txt','package.json','package-lock.json','tsconfig.json','playwright.config.ts','.env.example','.gitignore'):
    files.append(ROOT/name)
for directory in ('android','server','scripts','preview','tests','docs'):
    for path in (ROOT/directory).rglob('*'):
        if path.is_file() and not any(part in ('build','.gradle','__pycache__') for part in path.relative_to(ROOT/directory).parts) and path.name!='local.properties': files.append(path)
source_files=files+[ROOT/'media/story.json']
source_archive=OUT/'SceneBridge-github-source.zip'
with zipfile.ZipFile(source_archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
    for path in sorted(set(source_files)): bundle.write(path,Path('SceneBridge')/path.relative_to(ROOT))
for name in ('media/story.json','media/generated/mystery.mp4','media/generated/captions.vtt','media/generated/media-status.json','artifacts/SceneBridge-debug.apk','artifacts/tv-home.png','artifacts/tv-before-reveal.png','artifacts/tv-after-reveal.png','artifacts/tv-evidence-replay.png','artifacts/tv-resumed.png','artifacts/browser-home.png','artifacts/verification.json'):
    path=ROOT/name
    if not path.exists(): raise SystemExit(f'Missing required demo artifact: {name}')
    files.append(path)
movie=OUT/'SceneBridge-offline-walkthrough.mp4'
if movie.exists(): files.append(movie)
archive=OUT/'SceneBridge-offline-demo.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
    for path in sorted(set(files)): bundle.write(path,Path('SceneBridge')/path.relative_to(ROOT))
manifest={path.name:{'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in [OUT/'SceneBridge-debug.apk',archive,source_archive]}
(OUT/'checksums.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Packaged {archive} ({archive.stat().st_size/1024/1024:.1f} MiB). Source, media, APK and screenshots included; no credentials or SDK caches.')
print(f'GitHub source: {source_archive} ({source_archive.stat().st_size/1024:.0f} KiB). Extract and upload the folder contents.')
