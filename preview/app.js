const $ = id => document.getElementById(id);
const video=$('video');
const format = ms => `${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
let film, anchor=null, replayEnd=null, generation=0, pending, lastQuestion='';
function save(){ if(film) localStorage.setItem(`scenebridge:${film.id}`,String(anchor ?? video.currentTime*1000)); }
function reset(resume=false){
  generation++; pending?.abort(); $('ask').disabled=false;
  if(anchor!==null) video.currentTime=anchor/1000;
  anchor=null; replayEnd=null; $('replay-badge').hidden=true;
  $('response').hidden=true; $('heading').innerHTML='Stay in<br>the story.';
  $('intro').textContent="Missed a moment? Find the thread again, without looking ahead.";
  $('boundary-title').textContent='Your moment. Your context.';
  $('boundary-detail').textContent='Later passages stay out of the answer.';
  if(resume) void video.play().catch(showPlaybackError); else video.pause();
}
function showPlaybackError(){ $('play-state').textContent='VIDEO UNAVAILABLE · CHECK MEDIA SETUP'; }
async function ask(question){
  if(!film || !question.trim()) return;
  if(anchor===null) anchor=Math.round(video.currentTime*1000);
  anchor=Math.min(anchor,film.durationMs);
  replayEnd=null; video.pause(); video.currentTime=anchor/1000; $('replay-badge').hidden=true;
  pending?.abort(); pending=new AbortController(); const ticket=++generation;
  lastQuestion=question; $('ask').disabled=true;
  $('heading').innerHTML='A little context.<br>No looking ahead.';
  $('intro').textContent=question;
  $('boundary-title').textContent=`Bounded to ${format(anchor)}`;
  $('boundary-detail').textContent='Only completed passages before this moment.';
  $('response').hidden=false; $('response-label').textContent='FINDING THE THREAD';
  $('answer').textContent='Looking through earlier moments…'; $('evidence').replaceChildren();
  try{
    const response=await fetch('/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoId:film.id,positionMs:anchor,question}),signal:pending.signal});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || 'Answer service unavailable.');
    if(ticket!==generation) return;
    if(result.cutoffMs!==anchor || result.citations.some(c=>c.endMs>anchor || c.startMs<0 || c.endMs<=c.startMs)) throw new Error('Answer does not match this playback position.');
    $('response-label').textContent=result.status==='answered' ? "HERE'S THE CONTEXT" : 'NOT ESTABLISHED YET';
    $('answer').textContent=result.answer;
    for(const c of result.citations){
      const button=document.createElement('button'); button.className='evidence-card';
      const title=document.createElement('strong'); title.textContent=`▶  ${format(c.startMs)} — ${format(c.endMs)} · REVISIT THIS MOMENT`;
      const text=document.createElement('span'); text.textContent=c.text;
      button.append(title,text);
      button.onclick=()=>{replayEnd=c.endMs; video.currentTime=c.startMs/1000; $('replay-badge').hidden=false; void video.play().catch(showPlaybackError);};
      $('evidence').append(button);
    }
  }catch(error){
    if(error.name==='AbortError' || ticket!==generation) return;
    $('response-label').textContent='COULD NOT GET AN ANSWER'; $('answer').textContent=error.message;
    const retry=document.createElement('button'); retry.id='retry'; retry.textContent='Retry answer'; retry.onclick=()=>ask(lastQuestion); $('evidence').append(retry);
  }finally{if(ticket===generation) $('ask').disabled=false;}
}
async function init(){
  try{
    const response=await fetch('/catalog'); if(!response.ok) throw new Error('Could not load the film catalog.');
    const catalog=await response.json(); film=catalog.videos[0];
    $('title').textContent=film.title; $('subtitle').textContent=film.subtitle;
    $('mode').textContent=catalog.mode==='aws' ? 'AWS · BEDROCK' : 'OFFLINE FIXTURE';
    $('fixture-note').hidden=catalog.mode==='aws';
    video.src=film.mediaUrl; $('captions').src=film.captionsUrl;
    video.addEventListener('loadedmetadata',()=>{ video.currentTime=Math.min(Number(localStorage.getItem(`scenebridge:${film.id}`)||0)/1000,film.durationMs/1000); },{once:true});
  }catch(error){$('play-state').textContent=error.message;}
}
$('play').onclick=()=>{if(anchor!==null) reset(true);else if(video.paused){if(video.ended)video.currentTime=0;void video.play().catch(showPlaybackError);}else video.pause();};
$('back').onclick=()=>{const target=Math.max(0,(anchor??video.currentTime*1000)-10000);reset();video.currentTime=target/1000;};
$('forward').onclick=()=>{const target=Math.min(film?.durationMs??180000,(anchor??video.currentTime*1000)+10000);reset();video.currentTime=target/1000;};
$('seek').oninput=()=>{const target=Number($('seek').value);reset();video.currentTime=target;};
$('cc').onclick=()=>{const track=video.textTracks[0];if(track){track.mode=track.mode==='showing'?'hidden':'showing';$('cc').setAttribute('aria-pressed',String(track.mode==='showing'));}};
$('recap').onclick=()=>ask('Recap the last minute of completed scenes.');
$('explain').onclick=()=>ask('Explain the most recent scene using only what has already been established.');
$('question-form').onsubmit=event=>{event.preventDefault();void ask($('question').value);};
$('question').onfocus=()=>{
  if(film && anchor===null){anchor=Math.min(Math.round(video.currentTime*1000),film.durationMs);video.pause();}
};
$('resume').onclick=()=>reset(true);
video.ontimeupdate=()=>{const ms=video.currentTime*1000;$('position').textContent=format(ms);$('seek').value=String(video.currentTime);if(replayEnd!==null && ms>=replayEnd){video.pause();video.currentTime=replayEnd/1000;}};
video.onplay=()=>{$('screen-label').hidden=true;$('play').innerHTML='Ⅱ <span>Pause film</span>';$('play-state').textContent=replayEnd!==null?'EVIDENCE REPLAY':'NOW PLAYING';};
video.onpause=()=>{$('play').innerHTML='▶ <span>Play film</span>';$('play-state').textContent='PAUSED';save();};
video.onerror=showPlaybackError;
window.addEventListener('pagehide',save);
window.addEventListener('keydown',event=>{if(event.key==='Escape' && anchor!==null)reset();});
void init();
