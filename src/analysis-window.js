(()=>{
'use strict';
const stage=document.getElementById('analysisStartupStage'),detail=document.getElementById('analysisStartupDetail');
let connected=false,key=null,previous='',opened=false;
function fail(error){document.getElementById('analysisStartup').hidden=false;stage.textContent='분석 창을 불러오지 못했습니다.';detail.textContent=String(error?.message||error);document.querySelector('#analysisStartup progress').hidden=true;document.getElementById('analysisRetry').hidden=false}
window.addEventListener('error',e=>fail(e.error||e.message));
window.addEventListener('unhandledrejection',e=>fail(e.reason));
async function connect(){
 try{
  if(!window.JJaIMsaeAnalysisView)throw Error('분석 화면 스크립트를 불러오지 못했습니다. 앱을 다시 실행해 주세요.');
  const label=window.__TAURI__?.window?.getCurrentWindow().label;
  const token=label?.replace(/^analysis-/,'')||new URLSearchParams(location.search).get('token');
  if(!/^[a-f0-9-]{36}$/.test(token||''))throw Error('분석 데이터 연결 정보가 없습니다. 원래 창에서 다시 열어주세요.');
  key='jjaimsae-analysis-'+token;
  refresh();connected=true;
  const dialog=document.querySelector('dialog');dialog.querySelector('[data-close]').onclick=()=>window.__TAURI__.core.invoke('close_acoustics_window');
 }catch(e){fail(e)}
}
function refresh(){
 const raw=localStorage.getItem(key);if(!raw)throw Error('분석 데이터를 받지 못했습니다. 원래 플레이어 창에서 다시 열어주세요.');if(raw===previous)return;
 const data=JSON.parse(raw);previous=raw;window.JJaIMsaeAnalysisLyrics=()=>data.lyrics||{};
 window.JJaIMsaeAnalysisView.setProgress(data.progress||{stage:'complete',message:'분석 완료',percent:100});
 if(data.points?.length)window.JJaIMsaeAnalysisView.setData(data.points,data.path);
 if(!opened){window.JJaIMsaeAnalysisView.open();opened=true}
 document.getElementById('analysisStartup').hidden=true;
}
window.addEventListener('DOMContentLoaded',connect);
window.addEventListener('beforeunload',()=>{if(key)localStorage.removeItem(key)});
window.addEventListener('storage',e=>{if(connected&&e.key===key)try{refresh()}catch(error){fail(error)}});
setTimeout(()=>{if(!connected)fail('창 준비가 10초 이상 지연되었습니다. 다시 불러오기를 눌러 주세요.')},10000);
})();
