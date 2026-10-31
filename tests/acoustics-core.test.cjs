const test=require('node:test'),assert=require('node:assert/strict');const {metrics,bpm}=require('../src/acoustics-core.js');
const sr=48000;
function tone(mod=0){return Float32Array.from({length:sr*.12},(_,i)=>.5*(1+mod*Math.sin(2*Math.PI*20*i/sr))*Math.sin(2*Math.PI*200*i/sr))}
test('stable sine reports pitch, RMS, low jitter/shimmer and noise',()=>{const m=metrics(tone(),sr);assert.ok(Math.abs(m.pitchMean-200)<2);assert.ok(Math.abs(m.db+9.03)<.1);assert.ok(m.jitter<.5);assert.ok(m.shimmer<.5);assert.ok(m.nhr<.01);assert.ok(m.autocorrelation>.99)});
test('silence has no voiced measurements',()=>{const m=metrics(new Float32Array(sr*.12),sr);for(const v of Object.values(m))assert.equal(v,null)});
test('amplitude modulation increases shimmer',()=>{assert.ok(metrics(tone(.3),sr).shimmer>metrics(tone(),sr).shimmer+1)});
test('120 BPM pulse train and silence',()=>{const x=new Float32Array(sr*12);for(let i=0;i<x.length;i+=sr/2)for(let j=0;j<sr*.03;j++)x[i+j]=.9*Math.exp(-j/300);const buffer={sampleRate:sr,length:x.length,numberOfChannels:1,getChannelData:()=>x};assert.ok(Math.abs(bpm(buffer)-120)<1);assert.equal(bpm({...buffer,getChannelData:()=>new Float32Array(x.length)}),null)});

test('fractional beat spacing does not collapse 180 BPM to 60 BPM',()=>{const rate=12000,x=new Float32Array(rate*12);for(let i=0;i<x.length;i+=4000)for(let j=0;j<360&&i+j<x.length;j++)x[i+j]=Math.exp(-j/80);assert.ok(Math.abs(bpm({sampleRate:rate,length:x.length,numberOfChannels:1,getChannelData:()=>x})-180)<1)});
