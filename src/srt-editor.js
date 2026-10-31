(function(root){
'use strict';
const stamp=value=>{let ms=Math.round(Math.max(0,Number(value)||0)*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000);return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
function seconds(text){const m=text.trim().match(/^(\d+):([0-5]\d):([0-5]\d)[,.](\d{3})$/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000:NaN}
function serialize(cues){return cues.map((cue,i)=>{if(!Number.isFinite(cue.s)||!Number.isFinite(cue.e)||cue.s<0||cue.e<=cue.s)throw Error(`${i+1}번 자막의 마침 시간은 시작 시간보다 뒤여야 합니다.`);return `${i+1}\r\n${stamp(cue.s)} --> ${stamp(cue.e)}\r\n${cue.t}`}).join('\r\n\r\n')+'\r\n'}
function progress(cues,time){const index=cues.findIndex(cue=>time>=cue.s&&time<cue.e);if(index<0)return {index:-1,ratio:0,elapsed:0,duration:0};const cue=cues[index],duration=cue.e-cue.s,elapsed=Math.max(0,time-cue.s);return {index,ratio:Math.max(0,Math.min(1,elapsed/duration)),elapsed,duration}}
function updateProgress(app){
 const bar=document.getElementById('srtCueProgress');if(!bar)return;
 const state=progress(app.srt,app.a.currentTime+(Number(app.srtDelay.value)||0)),percent=state.ratio*100;
 document.getElementById('srtCueProgressFill').style.width=percent+'%';
 bar.setAttribute('aria-valuenow',percent.toFixed(1));bar.setAttribute('aria-valuetext',state.index<0?'자막 대기':`${state.index+1}번 자막 ${Math.round(percent)}%`);
 document.getElementById('srtCueElapsed').textContent=state.index<0?'자막 대기':`${state.index+1}번 · ${state.elapsed.toFixed(1)} / ${state.duration.toFixed(1)}초`;
 document.getElementById('srtCueRemaining').textContent=state.index<0?'':`남은 ${(state.duration-state.elapsed).toFixed(1)}초 · ${Math.round(percent)}%`;
}
function render(app){
 const $=id=>document.getElementById(id),track=app.tracks[app.i],status=$('srtEditStatus'),save=$('srtSave'),download=$('srtDownload');
 if(!save)return;
 save.disabled=download.disabled=!app.srt.length;
 $('srtSummary').textContent=app.srt.length?`${app.srt.length}개 자막 · ${stamp(app.srt[0].s)} ~ ${stamp(Math.max(...app.srt.map(c=>c.e)))}`:'연결된 자막 없음';
 status.textContent='시작·마침 시간과 내용을 편집할 수 있습니다.';app.srtList.replaceChildren();
 let invalid=new Set();
 app.srt.forEach((cue,index)=>{
  const row=document.createElement('div');row.className='srt-row srt-edit-row';row.dataset.n=index;
  const times=document.createElement('div');times.className='srt-edit-times';
  for(const [key,label] of [['s','시작'],['e','마침']]){
   const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement('input');input.value=stamp(cue[key]);input.setAttribute('aria-label',`${index+1}번 ${label} 시간`);
   input.onchange=()=>{const value=seconds(input.value),start=key==='s'?value:cue.s,end=key==='e'?value:cue.e;if(!Number.isFinite(value)||end<=start){input.setCustomValidity('HH:MM:SS,mmm 형식이며 마침은 시작보다 뒤여야 합니다.');invalid.add(input);status.textContent='시간 입력을 확인하세요.';}else{input.setCustomValidity('');invalid.delete(input);cue[key]=value;app.si=-1;app.sync();status.textContent='수정됨 · 저장이 필요합니다.'}};
   wrapper.append(input);times.append(wrapper);
  }
  const jump=document.createElement('button');jump.type='button';jump.textContent='▶ 이 자막 재생';jump.onclick=()=>{app.a.currentTime=cue.s;app.go()};times.append(jump);
  const text=document.createElement('textarea');text.value=cue.t;text.setAttribute('aria-label',`${index+1}번 자막 내용`);text.oninput=()=>{cue.t=text.value;app.si=-1;app.sync();status.textContent='수정됨 · 저장이 필요합니다.'};row.append(times,text);app.srtList.append(row);
 });
 async function write(copy){
  if(invalid.size){status.textContent='잘못된 시작·마침 시간을 먼저 수정하세요.';return}
  try{const content=serialize(app.srt);save.disabled=download.disabled=true;status.textContent=copy?'SRT 다운로드 위치 선택중…':'SRT 저장중…';
   const path=await root.__TAURI__.core.invoke('save_srt_edit',{path:track?.srt_path||null,name:track?.name||'subtitles',content,copy});
   status.textContent=path?(copy?'SRT 다운로드 완료: ':'SRT 편집 저장 완료: ')+path:'저장을 취소했습니다.';
  }catch(error){status.textContent='SRT 저장 실패: '+String(error)}finally{save.disabled=download.disabled=false}
 }
 save.onclick=()=>write(false);download.onclick=()=>write(true);
 if(!app.a.dataset.srtClockBound){app.a.dataset.srtClockBound='1';const tick=()=>{updateProgress(app);$('srtTimer').textContent=stamp(app.a.currentTime).replace(',','.');$('srtTotalTime').textContent='/ '+stamp(app.a.duration).replace(',','.')};['timeupdate','loadedmetadata','seeked','emptied'].forEach(event=>app.a.addEventListener(event,tick));}
 $('srtTimer').textContent=stamp(app.a.currentTime).replace(',','.');$('srtTotalTime').textContent='/ '+stamp(app.a.duration).replace(',','.');updateProgress(app);
}
const api={stamp,seconds,serialize,render,progress,updateProgress};if(typeof module==='object')module.exports=api;else root.JJaIMsaeSrtEditor=api;
})(typeof window==='object'?window:globalThis);
