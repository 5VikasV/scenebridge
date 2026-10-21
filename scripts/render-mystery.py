#!/usr/bin/env python3
"""Create an original illustrated short and VTT captions; no downloaded visual assets.

Optional narration: put one WAV/MP3 per passage in media/generated/narration/.
aws:prepare produces Polly narration, then calls this renderer before Transcribe.
"""
import json, math, os, subprocess, textwrap, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/generated'
STORY = json.loads((ROOT / 'media/story.json').read_text())
W, H = 1280, 720

def font(size, bold=False):
    names = ['DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf']
    for name in names:
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default(size=size)

def frame(index, p):
    image = Image.new('RGB', (W, H), '#080f1a')
    d = ImageDraw.Draw(image)
    # Original vector-style projection booth. All geometry is generated here.
    for y in range(H):
        q = y / H
        d.line((0,y,W,y), fill=(int(8+q*7),int(15+q*6),int(26+q*10)))
    d.polygon([(770,228),(1240,95),(1240,480),(770,320)], fill='#162d37')
    d.polygon([(770,242),(1220,130),(1220,443),(770,308)], fill='#203c43')
    d.rounded_rectangle((870,115,1215,445), radius=12, fill='#30494b', outline='#50716a', width=2)
    for x in range(897,1200,22): d.line((x,122,x-70,435), fill='#334d4e',width=2)
    d.rounded_rectangle((610,252,811,405),radius=16,fill='#24333d',outline='#537078',width=3)
    for cx,cy,r in [(657,211,65),(771,211,53)]:
        d.ellipse((cx-r,cy-r,cx+r,cy+r),fill='#162833',outline='#748e8d',width=4)
        for a in range(5):
            angle=a*math.tau/5
            xx,yy=cx+math.cos(angle)*r*.62,cy+math.sin(angle)*r*.62
            d.ellipse((xx-12,yy-12,xx+12,yy+12),fill='#080f1a',outline='#314d56',width=2)
        d.ellipse((cx-7,cy-7,cx+7,cy+7),fill='#e0b36a')
    d.rounded_rectangle((786,270,837,317),radius=7,fill='#9aaea2')
    d.rectangle((595,405,830,424),fill='#b88d54')
    d.rectangle((625,424,640,471),fill='#48535a')
    d.rectangle((786,424,801,471),fill='#48535a')
    # Character silhouettes, rather than stock media.
    for cx, color in [(396,'#446e72'),(518,'#755e54')]:
        d.ellipse((cx-19,285,cx+19,324),fill='#a28d78')
        d.polygon([(cx-27,334),(cx+25,334),(cx+41,449),(cx-39,449)],fill=color)
        d.line((cx-13,448,cx-17,488),fill=color,width=13)
        d.line((cx+12,448,cx+17,488),fill=color,width=13)
    # Brass key appears as an abstract thematic motif in every scene, no reveal text.
    d.ellipse((108,235,172,299),outline='#c8a367',width=8)
    d.line((161,290,240,369),fill='#c8a367',width=9)
    d.line((216,343,231,328),fill='#c8a367',width=8)
    d.line((230,358,245,343),fill='#c8a367',width=8)
    d.text((64,42),'S C E N E B R I D G E   /   O R I G I N A L S',font=font(15),fill='#75d0c6')
    d.text((64,86),'THE LAST SCREENING',font=font(43,True),fill='#edf3ef')
    d.text((65,143),'A short mystery in fifteen moments',font=font(19),fill='#92a9b2')
    d.rectangle((0,500,W,H),fill='#0c1520')
    d.text((64,526),f'{index+1:02d}   /   ORPHEUM CINEMA',font=font(14,True),fill='#c8a367')
    for row,line in enumerate(textwrap.wrap(p['text'],width=85)):
        d.text((64,563+row*32),line,font=font(23),fill='#e2e9eb')
    d.rounded_rectangle((64,680,1216,683),radius=1,fill='#243640')
    d.rounded_rectangle((64,680,64+int(1152*(index+1)/15),683),radius=1,fill='#70c9be')
    image.save(OUT / f'frame-{index:02}.png')

def stamp(ms):
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    captions=['WEBVTT','']
    segments=[]
    for i,p in enumerate(STORY['passages']):
        frame(i,p)
        captions += [p['id'],f"{stamp(p['startMs'])} --> {stamp(p['endMs'])}",p['text'],'']
        segments += [f"file 'frame-{i:02}.png'", 'duration 12']
    segments += ["file 'frame-14.png'"]
    (OUT/'frames.txt').write_text('\n'.join(segments)+'\n')
    (OUT/'captions.vtt').write_text('\n'.join(captions)+'\n')
    inputs=['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','concat','-safe','0','-i',str(OUT/'frames.txt')]
    voice=[]
    for i,p in enumerate(STORY['passages']):
        # Never let older offline WAVs shadow newly generated Polly MP3s.
        extension='.mp3' if '--polly' in sys.argv else '.wav'
        files=list((OUT/'narration').glob(p['id']+extension))
        if files:
            inputs += ['-i',str(files[0])]
            voice.append((len(voice)+1,p))
    if voice and len(voice)!=len(STORY['passages']):
        raise SystemExit('Narration must cover every passage; refusing a partly narrated film.')
    if voice:
        filters=[]
        for ix,p in voice:
            # Bound spoken audio to the same safe, canonical passage interval.
            filters.append(f"[{ix}:a]apad,atrim=0:8,asetpts=PTS-STARTPTS,adelay={p['startMs']}:all=1[a{ix}]")
        filters.append(''.join(f'[a{i}]' for i,_ in voice)+f'amix=inputs={len(voice)}:normalize=0,apad,atrim=0:180[audio]')
        inputs += ['-filter_complex',';'.join(filters),'-map','0:v','-map','[audio]','-c:a','aac','-b:a','128k']
    else:
        inputs += ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-map','0:v','-map','1:a','-c:a','aac','-b:a','64k']
    inputs += ['-t','180','-r','24','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'mystery.mp4')]
    subprocess.run(inputs,check=True)
    (OUT/'media-status.json').write_text(json.dumps({'narrated':bool(voice),'narrator':('Amazon Polly' if '--polly' in sys.argv else 'offline eSpeak-NG') if voice else 'none','source':'original code-drawn storyboard','durationMs':180000},indent=2)+'\n')
    print(f"Built {OUT/'mystery.mp4'} ({'narrated' if voice else 'captioned, silent offline edition'}).")

if __name__=='__main__': main()
