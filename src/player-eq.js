(function(){
'use strict';
const $=id=>document.getElementById(id),flat=()=>({eq:Array(20).fill(0),eqEnabled:false});
function normalize(value){return {eq:Array.from({length:20},(_,i)=>Math.max(-12,Math.min(12,Number(value?.eq?.[i])||0))),eqEnabled:value?.eqEnabled===true}}
let app,track=flat(),global=flat(),songEQ=new EQEffector(track),globalEQ=new EQEffector(global),timer;
function store(scope){if(scope==='global'){try{localStorage.setItem('jjaimsae-global-eq',JSON.stringify(global))}catch{app.msg('Global EQ 설정 저장 실패')}}else{const song=app.tracks[app.i];if(!song)return;song.eq_settings=structuredClone(track);clearTimeout(timer);timer=setTimeout(()=>app.persist().catch(e=>app.msg('곡별 EQ 저장 실패: '+e)),250)}}
function apply(scope){(scope==='global'?globalEQ:songEQ).applySettings(app.ctx,false)}
function paint(scope){const state=scope==='global'?global:track,panel=$(scope==='global'?'globalEQ':'trackEQ');panel.querySelector('input[type=checkbox]').checked=state.eqEnabled;panel.querySelectorAll('.peq-band').forEach((band,i)=>{band.querySelector('input').value=state.eq[i];band.querySelector('output').textContent=(state.eq[i]>0?'+':'')+state.eq[i].toFixed(1)+' dB'});if(scope==='track'){panel.querySelector('h2').textContent='곡별 20밴드 EQ · '+(app.tracks[app.i]?.name||'곡을 선택하세요');panel.querySelector('fieldset').disabled=!app.tracks[app.i]}else{$('toggleGlobalEQ').setAttribute('aria-pressed',String(global.eqEnabled));$('toggleGlobalEQ').classList.toggle('active',global.eqEnabled)}}
function globalVisibility(){const tab=$('globalEQTab');tab.hidden=!global.eqEnabled;if(!global.eqEnabled&&tab.classList.contains('active'))document.querySelector('.tab[data-tab="visual"]').click()}
function edit(scope){apply(scope);paint(scope);store(scope)}
function bindBandCollapse(panel,scope){
 const bands=panel.querySelector('.peq-bands'),button=document.createElement('button');
 bands.id=scope+'EQBands';
 button.type='button';button.className='peq-collapse';
 button.setAttribute('aria-controls',bands.id);
 function update(collapsed){
  bands.hidden=collapsed;
  panel.classList.toggle('peq-collapsed',collapsed);
  button.setAttribute('aria-expanded',String(!collapsed));
  button.textContent=collapsed?'▾ 슬라이더 펼치기':'▴ 슬라이더 접기';
 }
 update(true);
 button.onclick=()=>update(!bands.hidden);
 panel.querySelector('.peq-toolbar').append(button);
}
function bindGraphEditing(effect,canEdit,onChange){
 effect.setEQValue=(index,value)=>{
  if(!canEdit()||index<0||index>=effect.frequencies.length)return;
  effect.audioState.eq[index]=Math.round(effect.clampGain(value)*10)/10;
  effect.audioState.eqEnabled=true;
  onChange();effect.drawEQCanvas();
 };
 effect.bindGraphInteraction();
 for(const name of ['onpointerdown','ondblclick']){
  const handler=effect.canvas[name];
  effect.canvas[name]=event=>{if(canEdit())handler(event)};
 }
}
// Reuse the EQ renderer and the analysers at each individual EQ stage.
function graph(scope){
 const effect=scope==='global'?globalEQ:songEQ,panel=$(scope==='global'?'globalEQ':'trackEQ');
 const section=document.createElement('section');section.className='peq-response';
 section.innerHTML=`<div class="peq-response-heading"><b>주파수 특성</b><span>컬러 선: EQ 응답(추정) · 배경: EQ 적용 후 실시간 스펙트럼</span></div><canvas id="${scope}EQResponse" role="img" aria-label="${scope==='global'?'Global':'곡별'} EQ 주파수 응답 및 출력 스펙트럼"></canvas><p>20 Hz–20 kHz · 응답 ±12 dB · EQ를 끄면 응답은 0 dB로 표시됩니다.</p>`;
 panel.append(section);
 bindBandCollapse(panel,scope);
 effect.initVisualizer(scope+'EQResponse');
 bindGraphEditing(effect,()=>scope==='global'||!!app.tracks[app.i],()=>{
  panel.querySelector('select').value='';
  if(scope==='global')globalVisibility();
  edit(scope);
 });
 section.querySelector('p').textContent='포인트를 위아래로 드래그하여 조절 · 더블클릭: 0 dB · 조절 시 EQ 자동 적용 · 20 Hz–20 kHz / ±12 dB';
}
function animateGraphs(){
 let last=0;
 function frame(now){
  if(!document.hidden&&now-last>=33){last=now;for(const effect of [songEQ,globalEQ]){
   if(effect.canvas?.getBoundingClientRect().width>0)effect.drawEQCanvas();
  }}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
function build(scope){const effect=scope==='global'?globalEQ:songEQ,panel=$(scope==='global'?'globalEQ':'trackEQ');panel.innerHTML=`<h2>${scope==='global'?'Global EQ · 모든 곡에 공통 적용':'곡별 20밴드 EQ'}</h2><p>${scope==='global'?'곡을 바꿔도 같은 설정을 유지합니다.':'현재 곡에만 적용하며 재생 목록과 프로젝트에 저장합니다.'} 곡별 EQ → Global EQ → 간이 마스터링 순서로 적용됩니다.</p><fieldset><div class="peq-toolbar"><label><input type="checkbox"> EQ 적용</label><select aria-label="${scope==='global'?'Global':'곡별'} EQ 프리셋"><option value="">프리셋 선택</option></select><button type="button">Flat 초기화</button><span>20 Hz–16 kHz · ±12 dB</span></div><div class="peq-bands"></div></fieldset>`;
const state=scope==='global'?global:track;
const select=panel.querySelector('select');effect.getBuiltinPresetOrder().forEach(key=>{const option=document.createElement('option');option.value=key;option.textContent=effect.presetLabels[key];select.append(option)});
const bands=panel.querySelector('.peq-bands');effect.labels.forEach((label,i)=>{const band=document.createElement('label');band.className='peq-band';band.innerHTML=`<span>${label}</span><input type="range" min="-12" max="12" step="0.1" value="0" aria-label="${scope==='global'?'Global':'곡별'} EQ ${label} Hz"><output>0.0 dB</output>`;band.querySelector('input').oninput=e=>{state.eq[i]=Number(e.target.value);select.value='';edit(scope)};band.querySelector('input').ondblclick=()=>{state.eq[i]=0;edit(scope)};bands.append(band)});
panel.querySelector('input[type=checkbox]').onchange=e=>{state.eqEnabled=e.target.checked;if(scope==='global')globalVisibility();edit(scope)};
select.onchange=()=>{if(!effect.presets[select.value])return;state.eq=[...effect.presets[select.value]];state.eqEnabled=true;if(scope==='global')globalVisibility();edit(scope)};
panel.querySelector('button').onclick=()=>{state.eq=Array(20).fill(0);select.value='flat';edit(scope)};paint(scope)}
window.JJaIMsaePlayerEQ={normalize,bind(a){app=a;try{Object.assign(global,normalize(JSON.parse(localStorage.getItem('jjaimsae-global-eq'))))}catch{}build('track');build('global');graph('track');graph('global');animateGraphs();globalVisibility();$('toggleGlobalEQ').onclick=()=>{global.eqEnabled=!global.eqEnabled;globalVisibility();edit('global');if(global.eqEnabled)$('globalEQTab').click()};},load(a){app=a;Object.assign(track,normalize(a.tracks[a.i]?.eq_settings));paint('track');apply('track')},connect(a,source){app=a;return globalEQ.connect(a.ctx,songEQ.connect(a.ctx,source,false),false)}};
})();
