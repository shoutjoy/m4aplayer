(()=>{
'use strict';
const $=id=>document.getElementById(id),button=$('toggleEditorTools');
button.onclick=()=>{const hidden=document.body.classList.toggle('editor-tools-hidden');const label=hidden?'편집도구 보이기':'편집도구 감추기';button.title=label;button.dataset.tooltip=label;button.setAttribute('aria-label',label);button.setAttribute('aria-expanded',String(!hidden));window.dispatchEvent(new Event('resize'))};
const analyze=$('analyzeFileVolume'),media=$('audio'),cache=new Map();let revision=0;
async function analyzeCurrent(force=false){
 const path=$('infoPath').textContent;if(!path||path==='-')return;
 const token=revision;analyze.disabled=true;$('infoPeak').textContent=$('infoMean').textContent='분석중…';$('volumeAnalysisStatus').textContent='전체 파일 음량 분석중…';
 try{
  if(force||!cache.has(path)){const pending=window.__TAURI__.core.invoke('analyze_file_volume',{path});cache.set(path,pending);pending.catch(()=>{if(cache.get(path)===pending)cache.delete(path)})}
  const result=await cache.get(path);if(token!==revision||$('infoPath').textContent!==path)return;
  $('infoPeak').textContent=result.peak+'FS';$('infoMean').textContent=result.mean+'FS';$('volumeAnalysisStatus').textContent='전체 파일 분석 완료 · 원본 음량 기준';
 }catch(error){if(token===revision){$('infoPeak').textContent=$('infoMean').textContent='분석 실패';$('volumeAnalysisStatus').textContent='분석 실패: '+String(error)}}
 finally{if(token===revision)analyze.disabled=false}
}
window.addEventListener('jjaimsae-track-info',()=>{revision++;analyzeCurrent()});
analyze.onclick=()=>analyzeCurrent(true);
$('openInfoFolder').onclick=async()=>{const path=$('infoPath').textContent;if(!path||path==='-')return;try{await window.__TAURI__.core.invoke('reveal_media_file',{path})}catch(error){$('volumeAnalysisStatus').textContent='폴더 열기 실패: '+String(error)}};
})();
