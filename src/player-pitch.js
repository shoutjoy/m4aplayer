(()=>{'use strict';let semitones=0,engine;
const output=document.createElement('span');output.className='pitch-controls';output.innerHTML='<output id="tempoBpm" title="원본 파일의 추정 템포">BPM —</output> <button type="button" aria-label="피치 반음 내리기">−</button> <output>Pitch 0 st</output> <button type="button" aria-label="피치 반음 올리기">＋</button> <button type="button">원음</button>';
document.querySelector('.right-controls').prepend(output);
const label=output.querySelectorAll('output')[1];
function change(n){semitones=Math.max(-12,Math.min(12,n));label.textContent=`Pitch ${semitones>0?'+':''}${semitones} st`;engine?.update()}
const buttons=output.querySelectorAll('button');buttons[0].onclick=()=>change(semitones-1);buttons[1].onclick=()=>change(semitones+1);buttons[2].onclick=()=>change(0);
window.JJaIMsaePitch={connect(ctx,source){
 const input=ctx.createGain(),out=ctx.createGain(),dry=ctx.createGain();source.connect(input);input.connect(dry);dry.connect(out);let nodes=[];
 engine={update(){for(const n of nodes){try{n.stop?.()}catch{}n.disconnect()}nodes=[];input.disconnect();input.connect(dry);dry.gain.setTargetAtTime(semitones===0?1:0,ctx.currentTime,.015);if(!semitones)return;
 const ratio=2**(semitones/12),depth=.06,length=Math.max(128,Math.round(ctx.sampleRate*depth/Math.abs(1-ratio)));
 for(let phase=0;phase<2;phase++){
 const delay=ctx.createDelay(.2),gain=ctx.createGain(),mod=ctx.createBufferSource(),fade=ctx.createBufferSource(),mb=ctx.createBuffer(1,length,ctx.sampleRate),fb=ctx.createBuffer(1,length,ctx.sampleRate);
 for(let i=0;i<length;i++){const p=(i/length+phase*.5)%1;mb.getChannelData(0)[i]=.01+depth*(ratio>1?1-p:p);fb.getChannelData(0)[i]=Math.sin(Math.PI*p)**2}
 delay.delayTime.value=0;gain.gain.value=0;mod.buffer=mb;fade.buffer=fb;mod.loop=fade.loop=true;mod.connect(delay.delayTime);fade.connect(gain.gain);input.connect(delay);delay.connect(gain);gain.connect(out);mod.start();fade.start();nodes.push(mod,fade,delay,gain);
 }
 }};engine.update();return out;
}};
})();
