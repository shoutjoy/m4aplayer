(function(root){
'use strict';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function metrics(input,sr){
 const step=Math.max(1,Math.floor(sr/12000)),rate=sr/step,x=Float64Array.from({length:Math.floor(input.length/step)},(_,i)=>input[i*step]);
 const dc=mean([...x])||0;let energy=0;for(let i=0;i<x.length;i++){x[i]-=dc;energy+=x[i]*x[i]}
 const out={db:energy>0?10*Math.log10(energy/x.length):null,pitchMean:null,pitchMin:null,pitchMax:null,jitter:null,shimmer:null,nhr:null,autocorrelation:null};
 if(!x.length||energy/x.length<1e-8)return out;
 const pitches=[],correlations=[];let period=0;
 const size=Math.min(x.length,Math.ceil(rate*.05));
 for(let from=0;from+size<=x.length;from+=Math.floor(size/2)){
  const ac=[];for(let lag=0;lag<=Math.ceil(rate/55);lag++){let cross=0,a=0,b=0;for(let i=0;i<size-lag;i++){const v=x[from+i],w=x[from+i+lag];cross+=v*w;a+=v*v;b+=w*w}ac[lag]=cross/Math.sqrt(Math.max(1e-20,a*b))}
  let best=0;for(let lag=Math.ceil(rate/1000);lag<ac.length-1;lag++)if(ac[lag]>.65&&ac[lag]>=ac[lag-1]&&ac[lag]>ac[lag+1]&&(!best||ac[lag]>ac[best]+.03))best=lag;
  if(best){pitches.push(rate/best);correlations.push(ac[best]);period+=best}
 }
 if(!pitches.length)return out;
 out.pitchMean=mean(pitches);out.pitchMin=Math.min(...pitches);out.pitchMax=Math.max(...pitches);out.autocorrelation=mean(correlations);out.nhr=mean(correlations.map(r=>(1-r)/Math.max(r,1e-9)));
 period/=pitches.length;
 const pulses=[];let first=0;for(let i=1;i<Math.min(x.length,period*1.5);i++)if(x[i]>x[first])first=i;pulses.push(first);
 while(pulses.at(-1)+period*1.3<x.length){const last=pulses.at(-1);let best=Math.floor(last+period*.8);for(let i=best+1;i<=Math.ceil(last+period*1.2);i++)if(x[i]>x[best])best=i;pulses.push(best)}
 const periods=[],amplitudes=[];for(let i=1;i<pulses.length;i++){periods.push(pulses[i]-pulses[i-1]);let lo=Infinity,hi=-Infinity;for(let j=pulses[i-1];j<pulses[i];j++){lo=Math.min(lo,x[j]);hi=Math.max(hi,x[j])}amplitudes.push(hi-lo)}
 const variation=(a,factor)=>{const diff=[];for(let i=1;i<a.length;i++)if(a[i]>0&&a[i-1]>0&&Math.max(a[i]/a[i-1],a[i-1]/a[i])<=factor)diff.push(Math.abs(a[i]-a[i-1]));return diff.length?100*mean(diff)/mean(a):null};
 out.jitter=variation(periods,1.3);out.shimmer=variation(amplitudes,1.6);return out;
}
function bpm(buffer){
 const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c));
 const sr=buffer.sampleRate,hop=Math.max(1,Math.round(sr*.01)),env=[];
 for(let i=0;i<buffer.length;i+=hop){let e=0;for(let j=i;j<Math.min(i+hop,buffer.length);j++){let v=0;for(let c=0;c<buffer.numberOfChannels;c++)v+=Math.abs(channels[c][j]);e+=v/buffer.numberOfChannels}env.push(e/hop)}
 const onset=env.map((e,i)=>Math.max(0,e-(env[i-1]??e)));let best=0,score=0;
 // Very regular isolated onsets give a more precise tempo than integer lag bins.
 const peak=onset.reduce((a,b)=>Math.max(a,b),0),beats=[];
 for(let i=1;i<onset.length-1;i++)if(onset[i]>peak*.35&&onset[i]>=onset[i-1]&&onset[i]>onset[i+1]&&(!beats.length||i-beats.at(-1)>20))beats.push(i);
 if(beats.length>=6){const intervals=beats.slice(1).map((v,i)=>v-beats[i]),avg=mean(intervals),deviation=Math.sqrt(mean(intervals.map(v=>(v-avg)**2)));if(deviation/avg<.08){let tempo=60*sr/(hop*avg);while(tempo>200)tempo/=2;while(tempo<60)tempo*=2;return tempo}}
 const correlations=[];
 for(let lag=29;lag<=101;lag++){let sum=0,a=0,b=0;for(let i=lag;i<onset.length;i++){sum+=onset[i]*onset[i-lag];a+=onset[i]**2;b+=onset[i-lag]**2}correlations[lag]=sum/Math.sqrt(Math.max(1e-20,a*b))}
 for(let lag=30;lag<=100;lag++){const r=correlations[lag-1]+correlations[lag]+correlations[lag+1];if(r>score+.03){score=r;best=lag}}
 // Sub-bin centre avoids half/double-tempo errors when a beat spans fractional bins.
 if(best){const mass=correlations[best-1]+correlations[best]+correlations[best+1];if(mass>0)best=((best-1)*correlations[best-1]+best*correlations[best]+(best+1)*correlations[best+1])/mass}

 return score>.08&&best?60*sr/(hop*best):null;
}
const api={metrics,bpm};if(typeof module!=='undefined')module.exports=api;else root.JJaIMsaeAcoustics=api;
})(globalThis);
