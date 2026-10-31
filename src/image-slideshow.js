/* Audio-time driven image slides. Transition progress freezes with playback. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JJaIMsaeSlides=api})(typeof window!=='undefined'?window:globalThis,()=>{
'use strict';
const effects=['fade','slide-left','slide-right','zoom','wipe','none','random'];
const isVideo=path=>/\.(webm|mp4)$/i.test(path||'');
function paths(track){return [...new Set([...(track?.cover_paths||[]),track?.cover_path].filter(p=>typeof p==='string'&&p))]}
function settings(value={}){const n=(v,f,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;const interval=n(value?.interval,2,1,60);return {interval,duration:Math.min(n(value?.duration,.8,0,3),interval*.8),effect:value?.effect==='cut'?'none':effects.includes(value?.effect)?value.effect:'fade',fit:value?.fit==='cover'?'cover':'contain',layout:value?.layout==='images-left'?'images-left':'bars-left'}}
// Metadata determines video slots; still images use the configured interval.
const mediaDurations=new Map();
function probeVideos(track,convert){for(const path of paths(track).filter(isVideo)){if(mediaDurations.has(path))continue;const entry={duration:Infinity};mediaDurations.set(path,entry);const probe=document.createElement('video');probe.preload='metadata';probe.muted=true;const finish=duration=>{entry.duration=duration;probe.onloadedmetadata=probe.onerror=null;probe.removeAttribute('src');probe.load()};probe.onloadedmetadata=()=>finish(Number.isFinite(probe.duration)&&probe.duration>0?probe.duration:null);probe.onerror=()=>finish(null);probe.src=convert(path)}}
function choose(track,time,seconds,durations=mediaDurations){
 const images=paths(track),interval=Math.max(1,Math.min(60,Number(seconds)||2));
 const lengths=images.map(path=>isVideo(path)?(durations.get(path)?.duration??interval):interval);
 const total=lengths.reduce((sum,length)=>sum+length,0);let elapsed=Math.max(0,Number(time)||0);
 if(Number.isFinite(total)&&total>0)elapsed%=total;
 let index=0;while(index<images.length-1&&elapsed>=lengths[index]){elapsed-=lengths[index];index++}
 return {images,index,path:images[index]||null,elapsed};
}
function transition(value,time){const config=settings(value),step=Math.floor(Math.max(0,Number(time)||0)/config.interval),elapsed=Math.max(0,Number(time)||0)-step*config.interval;return {effect:config.effect==='random'?effects[(step*7+Math.floor(step/3))%6]:config.effect,progress:config.duration?Math.min(1,elapsed/config.duration):1}}
let key='',generation=0,loadedKey='',latest=null,animate=false,lastTrack='',lastIndex=-1,lastTime=0;
function paint(){if(!latest||loadedKey!==key)return;const {img,previous,config,time}=latest;const t=transition(config,time),p=animate?t.progress:1,effect=config.duration?t.effect:'none';img.style.opacity='1';img.style.transform='none';img.style.clipPath='none';if(previous){previous.style.opacity=p<1&&effect!=='none'?'1':'0';previous.style.transform='none'}if(p>=1||effect==='none')return;if(effect==='fade')img.style.opacity=String(p);else if(effect==='slide-left'){img.style.transform=`translateX(${(1-p)*100}%)`;if(previous)previous.style.transform=`translateX(${-p*100}%)`}else if(effect==='slide-right'){img.style.transform=`translateX(${-(1-p)*100}%)`;if(previous)previous.style.transform=`translateX(${p*100}%)`}else if(effect==='zoom'){img.style.opacity=String(p);img.style.transform=`scale(${1.16-.16*p})`}else if(effect==='wipe')img.style.clipPath=`inset(0 ${(1-p)*100}% 0 0)`}
function update({track,time,seconds,fit,effect,duration,enabled,convert,split=false,layout='bars-left',paused=true,rate=1}){
 const video=document.getElementById('slideVideo');
 if(!enabled&&video){video.pause();video.hidden=true;}
 const stage=document.getElementById('imageSlides'),img=document.getElementById('slideImage'),previous=document.getElementById('slidePrevious'),caption=document.getElementById('slideCaption');if(!stage||!img||!caption)return;stage.hidden=!enabled;const visual=document.getElementById('visual');visual?.classList.toggle('slideshow-mode',enabled&&!split);visual?.classList.toggle('slideshow-split',enabled&&split);visual?.classList.toggle('slideshow-reversed',enabled&&split&&layout==='images-left');const title=visual?.querySelector('.analyser-title b');if(title)title.textContent=enabled?(split?'FFT SPECTRUM + IMAGE SLIDESHOW':'ALBUM IMAGE SLIDESHOW'):'REAL-TIME FFT OCTAVE ANALYSER';if(!enabled)return;
 probeVideos(track,convert);
 const config=settings({interval:seconds,fit,effect,duration}),selected=choose(track,time,config.interval);img.style.objectFit=config.fit;if(previous)previous.style.objectFit=config.fit;latest={img,previous,caption,config,time:selected.elapsed};const next=JSON.stringify([track?.id,selected.images,selected.index]);
 if(video&&isVideo(selected.path)){
  if(next!==key){key=next;++generation;lastTrack=track?.id;lastIndex=selected.index;video.src=convert(selected.path);}
  img.hidden=true;if(previous)previous.hidden=true;
  video.hidden=false;video.muted=true;video.style.objectFit=config.fit;video.playbackRate=Number(rate)||1;
  const elapsed=selected.elapsed;
  if(Number.isFinite(video.duration)&&video.duration>0){const target=elapsed%video.duration;if(Math.abs(video.currentTime-target)>.25)video.currentTime=target;}
  if(paused)video.pause();else if(video.paused)video.play().catch(()=>{});
  video.onerror=()=>{caption.textContent='동영상을 읽을 수 없습니다. WebM/MP4 코덱을 확인하세요.'};
  caption.textContent=`${selected.index+1} / ${selected.images.length} · 동영상`;
  lastTime=Number(time)||0;return;
 }
 if(video){video.pause();video.hidden=true;}
 if(next===key){lastTime=time;paint();return}const sameTrack=lastTrack===track?.id,consecutive=(lastIndex+1)%Math.max(1,selected.images.length)===selected.index,near=Math.abs((Number(time)||0)-lastTime)<=Math.max(1,config.duration*2);const old=!img.hidden&&sameTrack?img.src:null;const canAnimate=!!old&&consecutive&&near;key=next;lastTrack=track?.id;lastIndex=selected.index;lastTime=Number(time)||0;const token=++generation;
 caption.textContent=selected.path?`${selected.index+1} / ${selected.images.length}`:'곡 이미지 관리에서 이미지를 추가하세요.';
 if(!selected.path){img.hidden=true;img.removeAttribute('src');if(previous){previous.hidden=true;previous.removeAttribute('src')}loadedKey=next;return}
 const loading=new Image();loading.onload=()=>{if(token!==generation)return;if(previous){previous.hidden=!old;if(old)previous.src=old}img.src=loading.src;img.hidden=false;animate=canAnimate;loadedKey=next;paint()};loading.onerror=()=>{if(token===generation)caption.textContent=`${selected.index+1} / ${selected.images.length} · 이미지를 읽을 수 없습니다.`};loading.src=convert(selected.path);
}
return {paths,settings,effects,choose,transition,update,isVideo};
});
