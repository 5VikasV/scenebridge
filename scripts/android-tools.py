#!/usr/bin/env python3
"""Workspace-local Android tooling. No writes to ~/.android or ~/.gradle."""
import os, subprocess, sys, zipfile, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'.local'
SDK=Path(os.environ.get('ANDROID_SDK_ROOT',str(LOCAL/'android-sdk')))
GRADLE=LOCAL/'gradle-8.11.1/bin/gradle'
env=dict(os.environ,ANDROID_HOME=str(SDK),ANDROID_SDK_ROOT=str(SDK),
         ANDROID_USER_HOME=str(LOCAL/'android'),ANDROID_AVD_HOME=str(LOCAL/'avd'),
         ANDROID_EMULATOR_HOME=str(LOCAL/'android'),ADB_VENDOR_KEYS=str(LOCAL/'android/adbkey'),
         GRADLE_USER_HOME=str(LOCAL/'gradle-cache'))
for folder in ('android','avd','gradle-cache'): (LOCAL/folder).mkdir(parents=True,exist_ok=True)

def run(args,**kwargs):
    return subprocess.run([str(a) for a in args],env=env,cwd=ROOT,check=True,**kwargs)

def extract_gradle():
    if not GRADLE.exists():
        archive=LOCAL/'downloads/gradle.zip'
        if not archive.exists():
            archive.parent.mkdir(parents=True,exist_ok=True)
            run(['curl','--max-time','240','-fL','--silent','--show-error','https://services.gradle.org/distributions/gradle-8.11.1-bin.zip','-o',archive])
        with zipfile.ZipFile(archive) as z: z.extractall(LOCAL)
        GRADLE.chmod(0o755)

def setup():
    manager=SDK/'cmdline-tools/latest/bin/sdkmanager'
    if not manager.exists():
        archive=LOCAL/'downloads/android-commandline.zip'
        archive.parent.mkdir(parents=True,exist_ok=True)
        if not archive.exists(): run(['curl','--max-time','240','-fL','--silent','--show-error','https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip','-o',archive])
        target=SDK/'cmdline-tools'
        target.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(archive) as z: z.extractall(target)
        (target/'cmdline-tools').rename(target/'latest')
        for executable in (target/'latest/bin').iterdir(): executable.chmod(0o755)
    # SDK license acceptance is explicit in this setup command, not on installation.
    run([manager,f'--sdk_root={SDK}','--licenses'],input='y\n'*100,text=True)
    run([manager,f'--sdk_root={SDK}','platform-tools','platforms;android-35','build-tools;35.0.0','emulator','system-images;android-30;android-tv;x86'])
    extract_gradle()
    (ROOT/'android/local.properties').write_text(f'sdk.dir={SDK}\n')
    print('Android toolchain ready. KVM visible:',Path('/dev/kvm').exists())

def build():
    extract_gradle()
    (ROOT/'android/local.properties').write_text(f'sdk.dir={SDK}\n')
    run([GRADLE,'-p','android','--no-daemon','--console=plain','assembleDebug','testDebugUnitTest','lintDebug'])
    artifacts=ROOT/'artifacts'
    artifacts.mkdir(exist_ok=True)
    shutil.copy2(ROOT/'android/app/build/outputs/apk/debug/app-debug.apk',artifacts/'SceneBridge-debug.apk')
    print('APK:',artifacts/'SceneBridge-debug.apk')

def emulator(wipe=False):
    avdmanager=SDK/'cmdline-tools/latest/bin/avdmanager'
    if not (LOCAL/'avd/SceneBridge-TV.avd').exists():
        run([avdmanager,'create','avd','--force','--name','SceneBridge-TV','--package','system-images;android-30;android-tv;x86','--device','tv_1080p'],input='no\n',text=True)
    adb=SDK/'platform-tools/adb'
    if not (LOCAL/'android/adbkey').exists(): run([adb,'keygen',LOCAL/'android/adbkey'])
    run([adb,'start-server'])
    args=[SDK/'emulator/emulator','-avd','SceneBridge-TV','-no-audio','-no-boot-anim','-gpu','swiftshader','-memory','2048','-no-snapshot','-no-window','-no-metrics']
    if wipe: args+=['-wipe-data']
    if not Path('/dev/kvm').exists():
        print('KVM is not exposed; attempting slower software CPU emulation.',flush=True)
        args+=['-accel','off']
    run(args)

def restart():
    import signal,time
    # Only stop the emulator launched by this workspace, never another AVD.
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit(): continue
        try:
            argv=(proc/'cmdline').read_bytes().split(b'\0')
            if argv and str(SDK/'emulator/qemu').encode() in argv[0] and b'SceneBridge-TV' in argv:
                os.kill(int(proc.name),signal.SIGTERM)
        except (OSError,ProcessLookupError): pass
    time.sleep(3)
    run([SDK/'platform-tools/adb','kill-server'])
    emulator(wipe=True)

def test():
    extract_gradle()
    run([SDK/'platform-tools/adb','install','-r',ROOT/'artifacts/SceneBridge-debug.apk'])
    run([SDK/'platform-tools/adb','shell','pm','clear','com.scenebridge.tv'])
    run([GRADLE,'-p','android','--no-daemon','--console=plain','connectedDebugAndroidTest'])

def verify():
    import time
    adb=SDK/'platform-tools/adb'
    run([adb,'start-server'])
    run([adb,'devices'])
    for _ in range(36):
        result=subprocess.run([str(adb),'shell','getprop','sys.boot_completed'],env=env,capture_output=True,text=True)
        if result.stdout.strip()=='1': break
        time.sleep(5)
    else: raise SystemExit('Emulator did not finish booting within three minutes.')
    run([adb,'install','-r',ROOT/'artifacts/SceneBridge-debug.apk'])
    run([adb,'shell','am','start','-n','com.scenebridge.tv/.MainActivity'])
    time.sleep(5)
    with open(ROOT/'artifacts/tv-home.png','wb') as image:
        run([adb,'exec-out','screencap','-p'],stdout=image)
    run([adb,'shell','pidof','com.scenebridge.tv'])
    print('Native app installed and launched. Screenshot: artifacts/tv-home.png')

def record():
    import time,signal
    adb=SDK/'platform-tools/adb'
    run([GRADLE,'-p','android','--no-daemon','--console=plain','assembleDebug','assembleDebugAndroidTest'])
    shutil.copy2(ROOT/'android/app/build/outputs/apk/debug/app-debug.apk',ROOT/'artifacts/SceneBridge-debug.apk')
    run([adb,'install','-r',ROOT/'artifacts/SceneBridge-debug.apk'])
    run([adb,'install','-r',ROOT/'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'])
    run([adb,'shell','pm','clear','com.scenebridge.tv'])
    run([adb,'shell','am','start','-n','com.scenebridge.tv/.MainActivity'])
    time.sleep(3)
    recording=subprocess.Popen([str(adb),'shell','screenrecord','--size','1280x720','--bit-rate','3000000','--time-limit','120','/sdcard/scenebridge-offline.mp4'],env=env)
    time.sleep(1)
    try:
        result=run([adb,'shell','am','instrument','-w','-e','class','com.scenebridge.tv.PlayerFlowTest#questionIsWithheldBeforeRevealAndAnsweredAfterward','-e','recording','true','com.scenebridge.tv.test/androidx.test.runner.AndroidJUnitRunner'],capture_output=True,text=True)
        print(result.stdout)
        if 'FAILURES!!!' in result.stdout or 'OK (1 test)' not in result.stdout: raise RuntimeError('Recorded walkthrough did not pass its interaction checks.')
    finally:
        pid=subprocess.run([str(adb),'shell','pidof','screenrecord'],env=env,capture_output=True,text=True).stdout.strip()
        if pid: run([adb,'shell','kill','-2',pid])
        recording.wait(timeout=15)
    run([adb,'pull','/sdcard/scenebridge-offline.mp4',ROOT/'artifacts/SceneBridge-offline-walkthrough.mp4'])
    screenshots()
    print('Recorded native offline walkthrough. Screenrecord contains no microphone audio.')

def screenshots():
    adb=SDK/'platform-tools/adb'
    for name in ('tv-question-dialog.png','tv-before-reveal.png','tv-after-reveal.png','tv-evidence-replay.png','tv-resumed.png'):
        with open(ROOT/'artifacts'/name,'wb') as output:
            run([adb,'exec-out','run-as','com.scenebridge.tv','cat',f'files/{name}'],stdout=output)
        if (ROOT/'artifacts'/name).read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
            raise RuntimeError(f'Could not retrieve a valid native screenshot: {name}')

def home():
    # Explicit demo reset affects only this application's local test progress.
    run([SDK/'platform-tools/adb','shell','pm','clear','com.scenebridge.tv'])
    verify()

if __name__=='__main__':
    {'setup':setup,'build':build,'emulator':emulator,'verify':verify,'restart':restart,'test':test,'record':record,'screenshots':screenshots,'home':home}[sys.argv[1] if len(sys.argv)>1 else 'build']()
