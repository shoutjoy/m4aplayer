/* Sample peak (dBFS), independent of the smoothed FFT bin magnitudes. */
(function(root){
'use strict';
function tracker(){let held=-Infinity,until=0,identity,position=0;return {update(peak,now,id,time,playing){
 if(id!==identity||time<position-.05||Math.abs(time-position)>1.5){held=-Infinity;until=0;identity=id}position=time;
 const current=peak>0?20*Math.log10(peak):-Infinity;
 if(playing){if(current>=held||now>=until){held=current;until=now+2000}}
 return {current:playing?current:-Infinity,held,clipped:playing&&peak>=1};
}}}
function color(value){
 return value>-14?'#ff4762':'#ff8a18';
}
function history(){let records=[],identity,position=0,elapsed=0,maximum=0;return {update(peak,id,time,playing){
 const delta=time-position;
 if(id!==identity||delta<-.05||Math.abs(delta)>1.5){records=[];elapsed=0;maximum=0;identity=id;position=time;return records}
 position=time;
 if(playing){maximum=Math.max(maximum,peak);elapsed+=Math.max(0,delta);
  if(elapsed>=1){records=[...records,{time,value:maximum>0?20*Math.log10(maximum):-Infinity}].slice(-10);elapsed=0;maximum=0;}
 }
 return records;
}}}
function create(analyser,context,source){
 let channels=[analyser];
 if(context?.createChannelSplitter&&source){
  const splitter=context.createChannelSplitter(2),silent=context.createGain();silent.gain.value=0;silent.connect(context.destination);source.connect(splitter);
  channels=[0,1].map(index=>{const node=context.createAnalyser();node.fftSize=2048;splitter.connect(node,index);node.connect(silent);return node});
 }
 const buffers=channels.map(node=>new Float32Array(node.fftSize)),state=tracker(),log=history();let signature;return {update(media,id,now=performance.now()){
 let peak=0;channels.forEach((node,index)=>{node.getFloatTimeDomainData(buffers[index]);for(const sample of buffers[index])peak=Math.max(peak,Math.abs(sample))});
 const result=state.update(peak,now,id,media.currentTime,!media.paused&&!media.ended);
 const records=log.update(peak,id,media.currentTime,!media.paused&&!media.ended);
 const lamp=document.getElementById('clipLamp'),key=JSON.stringify(records);
 if(lamp&&key!==signature){signature=key;lamp.classList.add('peak-history');lamp.title='최근 10개 · 1초 구간별 최대 샘플 피크 · 오래된 기록 → 최신 기록';lamp.innerHTML='<span class="peak-history-label">PEAK dBFS</span><span class="peak-history-values">'+(records.length?records.map(record=>`<span class="peak-history-item ${record.value>=0?'is-clipped':''}" style="--peak-color:${color(record.value)}" title="${record.time.toFixed(1)}초 · ${record.value>=0?'클리핑':'샘플 피크'}">${Number.isFinite(record.value)?record.value.toFixed(1):'−∞'}</span>`).join(''):'<span class="peak-history-wait">기록 대기</span>')+'</span>';}

 return result;
}}}
function spectrumTracker(){let bands=[],identity,position=0;return {update(values,id,time,playing){
 if(id!==identity||time<position-.05||Math.abs(time-position)>1.5){bands=[];identity=id}position=time;
 bands=values.map((value,i)=>{const old=bands[i];return !old||playing&&(value>=old.value||time>=old.until)?{value,until:time+2}:old});
 return bands.map(b=>b.value);
}}}
function drawSpectrum(g,w,h,values){
 if(!values.length)return;const bw=(w-50)/values.length-2,maximum=Math.max(...values);if(maximum<=0)return;
 const y=value=>h-value/255*(h-5);g.save();g.strokeStyle='#8ceaff';g.lineWidth=2;
 values.forEach((value,i)=>{if(value<=0)return;const x=45+i*(bw+2);g.beginPath();g.moveTo(x,y(value));g.lineTo(x+bw,y(value));g.stroke()});
 const top=y(maximum);g.lineWidth=1;g.setLineDash([4,4]);g.beginPath();g.moveTo(45,top);g.lineTo(w-8,top);g.stroke();g.setLineDash([]);
 const index=values.indexOf(maximum),x=45+index*(bw+2)+bw/2;g.beginPath();g.arc(x,top,4,0,Math.PI*2);g.fillStyle='#baf4ff';g.fill();
 const db=-100+maximum/255*100,text=`막대 최고점 ${db.toFixed(1)} dBFS · 2초 유지`;g.font='11px ui-monospace,monospace';const width=g.measureText(text).width+12,left=Math.max(45,w-width-10),labelY=Math.min(h-18,Math.max(0,top-22));g.fillStyle='#091421ee';g.fillRect(left,labelY,width,18);g.fillStyle='#8ceaff';g.fillText(text,left+6,labelY+13);g.restore();
}
function draw(g,w,h,value){if(!Number.isFinite(value))return;const y=5+(h-5)*(1-Math.max(0,Math.min(1,(value+100)/100)));g.save();g.strokeStyle=value>=0?'#ff5268':'#ffd166';g.setLineDash([6,4]);g.beginPath();g.moveTo(45,y);g.lineTo(w-8,y);g.stroke();g.setLineDash([]);g.font='11px ui-monospace,monospace';const text=`오디오 PEAK ${value.toFixed(1)} dBFS · 2초 유지`,width=g.measureText(text).width+12,x=Math.max(45,w-width-10),labelY=Math.min(h-17,Math.max(22,y+5));g.fillStyle='#091421e6';g.fillRect(x,labelY,width,17);g.fillStyle=value>=0?'#ff5268':'#ffd166';g.fillText(text,x+6,labelY+12);g.restore();}
const api={tracker,history,color,create,draw,spectrumTracker,drawSpectrum};if(typeof module==='object')module.exports=api;else root.JJaIMsaePeak=api;
})(typeof window==='object'?window:globalThis);
