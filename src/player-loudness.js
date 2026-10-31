/* Matches the mastering panel's RMS-based loudness estimate; not a certified LUFS meter. */
(function(root){
'use strict';
const targets=[['Spotify',-14],['YouTube',-14],['Apple Music',-16],['Amazon Music',-14]];
const lufs=energy=>energy>1e-12?-0.691+10*Math.log10(energy):-Infinity;
const format=value=>Number.isFinite(value)?value.toFixed(1):'−∞';
function view(mode){
 const panel=document.getElementById('playerLoudness');
 if(!panel)return;
 panel.hidden=!['bar-loudness','bar-history-loudness','loudness','loudness-view'].includes(mode);
 const visual=document.getElementById('visual');
 visual?.classList.toggle('loudness-only',mode==='loudness');
 visual?.classList.toggle('loudness-history-view',mode==='loudness-view');
 visual?.classList.toggle('loudness-combined',mode==='bar-history-loudness');
 const labels=visual?.querySelector?.('.freq-labels'),stage=visual?.querySelector?.('.visual-stage');
 if(labels&&stage){if(mode==='bar-history-loudness')stage.append(labels);else stage.after(labels)}
 const title=visual?.querySelector?.('.analyser-title b');if(title)title.textContent=mode==='bar-history-loudness'?'FFT + LOUDNESS HISTORY + STREAMING TARGETS':mode==='loudness-view'?'LOUDNESS VIEW':mode==='loudness'?'STREAMING TARGETS':mode==='bar-loudness'?'FFT SPECTRUM + STREAMING TARGETS':title.textContent;
 const history=document.getElementById('playerLoudnessHistory');if(history)history.hidden=!['loudness-view','bar-history-loudness'].includes(mode);
 document.getElementById('visual')?.classList.toggle('loudness-split',['bar-loudness','bar-history-loudness'].includes(mode));
 if(panel.childElementCount)return;
 panel.innerHTML='<h3>STREAMING TARGETS</h3><div class="pl-reading">누적 추정 <strong id="plValue">−∞</strong> LUFS</div><p>막대와 수치: 최근 400ms 음량 · 0.1초마다 갱신</p>'+targets.map(([name,target],i)=>`<article><div><b>${name}</b><span>${target} LUFS</span></div><div class="pl-live-reading">현재 <strong id="plLive${i}">−∞ LUFS</strong><span>목표 ${target} LUFS</span></div><div class="pl-meter" role="meter" aria-label="${name} 실시간 라우드니스" aria-valuemin="-60" aria-valuemax="0" id="plMeter${i}"><span id="plBar${i}"></span><i style="left:${(target+60)/60*100}%" title="목표 ${target} LUFS"></i></div><small id="plDiff${i}">재생 대기</small></article>`).join('')+'<p>점선: 사이트 목표 · 막대: 현재 음량 (Momentary)<br>RMS 기반 근사값이며 정밀 BS.1770 측정값과 차이가 있습니다. 음량은 자동 변경하지 않습니다.</p>';
}
// Focus the compact history on the central 90% of finite readings; silence is a gap.
function historyRange(points){
 const values=points.flatMap(p=>p.values).filter(Number.isFinite).sort((a,b)=>a-b);
 if(!values.length)return {min:-36,max:-6};
 const at=q=>values[Math.floor((values.length-1)*q)];
 const center=(at(.05)+at(.95))/2,span=Math.max(12,at(.95)-at(.05)+6);
 const min=Math.max(-100,Math.min(3-span,Math.floor((center-span/2)/3)*3));
 return {min,max:Math.min(3,min+Math.ceil(span/3)*3)};
}
function drawHistory(points,now){
 const c=document.getElementById('plHistoryCanvas');if(!c||!c.clientWidth||!c.clientHeight)return;
 const d=root.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;
 const g=c.getContext('2d');g.scale(d,d);
 const compact=document.getElementById('visual')?.classList?.contains('loudness-combined');
 const range=compact?historyRange(points):{min:-60,max:0},left=38,right=w-8,top=12,bottom=h-22;
 const y=v=>top+(bottom-top)*(1-(v-range.min)/(range.max-range.min));
 g.font='10px sans-serif';
 const step=Math.max(3,Math.ceil((range.max-range.min)/Math.max(2,Math.floor((bottom-top)/28))/3)*3);
 for(let v=Math.ceil(range.min/step)*step;v<=range.max;v+=step){g.strokeStyle='#23364b';g.setLineDash([]);g.beginPath();g.moveTo(left,y(v));g.lineTo(right,y(v));g.stroke();g.fillStyle='#8ca6be';g.fillText(v,0,y(v)+3)}
 [-14,-16].forEach(v=>{if(v<range.min||v>range.max)return;g.strokeStyle='#199957';g.setLineDash([5,4]);g.beginPath();g.moveTo(left,y(v));g.lineTo(right,y(v));g.stroke()});g.setLineDash([]);
 g.save();g.beginPath();g.rect(left,top,Math.max(0,right-left),Math.max(0,bottom-top));g.clip();
 ['#ff8a18','#19d980','#38bdf8'].forEach((color,i)=>{g.strokeStyle=color;g.lineWidth=1.5;g.beginPath();let connected=false;points.forEach(p=>{if(!Number.isFinite(p.values[i])){connected=false;return}const x=left+(right-left)*(1-(now-p.now)/120000);if(connected)g.lineTo(x,y(p.values[i]));else g.moveTo(x,y(p.values[i]));connected=true});g.stroke()});g.restore();
 g.fillStyle='#8ca6be';g.fillText('−120s',left,h-4);g.fillText('현재',Math.max(left,right-24),h-4);
}
function create(analyser){
 const samples=new Float32Array(analyser.fftSize);
 let sum=0,count=0,last=-Infinity,track,time=0,recent=[],points=[];
 return {update(media,id,now=performance.now()){
  if(id!==track||media.currentTime<time-.05||Math.abs(media.currentTime-time)>1.5){sum=0;count=0;recent=[];points=[];last=-Infinity;track=id;}
  time=media.currentTime;
  if(!media.paused&&!media.ended&&now-last>=100){
   analyser.getFloatTimeDomainData(samples);
   let energy=0;for(const sample of samples)energy+=sample*sample;
   energy/=samples.length;sum+=energy;count++;last=now;
   recent.push({now,energy});recent=recent.filter(p=>now-p.now<=3000);
   const mean=ms=>{const values=recent.filter(p=>now-p.now<=ms);return lufs(values.reduce((a,p)=>a+p.energy,0)/Math.max(1,values.length))};
   points.push({now,values:[mean(400),mean(3000),lufs(sum/count)]});points=points.filter(p=>now-p.now<=120000);
   drawHistory(points,now);
  }
  drawHistory(points,Number.isFinite(last)?last:now);
  const value=lufs(count?sum/count:0),live=points.length?points[points.length-1].values[0]:-Infinity;
  const reading=document.getElementById('plValue');if(reading)reading.textContent=format(value);
  targets.forEach(([,target],i)=>{
   const bar=document.getElementById('plBar'+i),diff=document.getElementById('plDiff'+i),label=document.getElementById('plLive'+i),meter=document.getElementById('plMeter'+i);
   if(label)label.textContent=format(live)+' LUFS';
   if(meter){meter.setAttribute('aria-valuenow',String(Number.isFinite(live)?Math.max(-60,Math.min(0,live)):-60));meter.setAttribute('aria-valuetext',format(live)+' LUFS')}
   if(bar)bar.style.width=Math.max(0,Math.min(100,(live+60)/60*100))+'%';
   if(diff)diff.textContent=Number.isFinite(live)?`현재 목표까지 ${target-live>=0?'+':''}${(target-live).toFixed(1)} dB · ${Math.abs(target-live)<1?'목표 근처':live>target?'목표보다 큼':'목표보다 작음'}`:'재생 대기';
  });
  return value;
 }};
}
const api={targets,lufs,create,view,historyRange};
if(typeof module==='object')module.exports=api;else root.JJaIMsaeLoudness=api;
})(typeof window==='object'?window:globalThis);
