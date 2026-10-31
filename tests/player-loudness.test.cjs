const {test}=require('node:test');
const assert=require('node:assert/strict');
const meter=require('../src/player-loudness.js');
test('loudness matches mastering estimate and amplitude changes give correct decibel changes',()=>{
 assert.equal(meter.lufs(0),-Infinity);
 assert.ok(Math.abs(meter.lufs(.01)-(-20.691))<1e-9);
 assert.ok(Math.abs(meter.lufs(.04)-meter.lufs(.01)-6.0206)<.0001);
 assert.deepEqual(meter.targets.map(t=>t[1]),[-14,-14,-16,-14]);
});
test('meter freezes on pause and resets accumulated energy on song changes and seek',()=>{
 global.document={getElementById:()=>null};let amplitude=.1;
 const instance=meter.create({fftSize:32,getFloatTimeDomainData:a=>a.fill(amplitude)});
 const media={paused:false,ended:false,currentTime:0};
 const first=instance.update(media,'a',0);media.paused=true;amplitude=.5;
 assert.equal(instance.update(media,'a',1000),first);
 media.paused=false;media.currentTime=.1;
 const next=instance.update(media,'b',1100);assert.ok(next>first+10);
 amplitude=.01;media.currentTime=20;
 assert.ok(instance.update(media,'b',1200)<first-19);
 delete global.document;
});

test('view switches explicitly hide meters in bar mode and select independent loudness layouts',()=>{
 const classes=new Map(),panel={childElementCount:1},history={};
 global.document={getElementById:id=>id==='playerLoudness'?panel:id==='playerLoudnessHistory'?history:{classList:{toggle:(key,value)=>classes.set(key,value)}}};
 meter.view('bar');assert.equal(panel.hidden,true);assert.equal(history.hidden,true);assert.equal(classes.get('loudness-split'),false);
 meter.view('loudness');assert.equal(panel.hidden,false);assert.equal(history.hidden,true);assert.equal(classes.get('loudness-only'),true);
 meter.view('loudness-view');assert.equal(panel.hidden,false);assert.equal(history.hidden,false);assert.equal(classes.get('loudness-history-view'),true);
 meter.view('bar-loudness');assert.equal(classes.get('loudness-split'),true);assert.equal(history.hidden,true);
 delete global.document;
});

test('site bars follow recent momentary energy rather than the slowly changing integrated value',()=>{
 const elements=new Map();global.document={getElementById:id=>{if(id==='plHistoryCanvas')return null;if(!elements.has(id))elements.set(id,{style:{},setAttribute(){}});return elements.get(id)}};
 let amplitude=.1;const instance=meter.create({fftSize:32,getFloatTimeDomainData:a=>a.fill(amplitude)}),media={paused:false,ended:false,currentTime:0};
 for(let i=0;i<100;i++){media.currentTime=i/10;instance.update(media,'a',i*100)}
 const before=Number.parseFloat(elements.get('plBar0').style.width);amplitude=.5;
 for(let i=100;i<106;i++){media.currentTime=i/10;instance.update(media,'a',i*100)}
 assert.ok(Number.parseFloat(elements.get('plBar0').style.width)>before+20);
 assert.match(elements.get('plLive0').textContent,/-6.7 LUFS/);
 assert.ok(Number.parseFloat(elements.get('plValue').textContent)<-16);
 const frozen=elements.get('plBar0').style.width;media.paused=true;amplitude=0;instance.update(media,'a',15000);assert.equal(elements.get('plBar0').style.width,frozen);
 delete global.document;
});

test('combined view retains spectrum and enables history beside streaming targets',()=>{
 const classes=new Map(),panel={childElementCount:1},history={};
 global.document={getElementById:id=>id==='playerLoudness'?panel:id==='playerLoudnessHistory'?history:{classList:{toggle:(key,value)=>classes.set(key,value)}}};
 meter.view('bar-history-loudness');assert.equal(panel.hidden,false);assert.equal(history.hidden,false);assert.equal(classes.get('loudness-combined'),true);assert.equal(classes.get('loudness-split'),true);assert.equal(classes.get('loudness-history-view'),false);
 meter.view('bar');assert.equal(history.hidden,true);assert.equal(classes.get('loudness-combined'),false);delete global.document;
});
test('compact history focuses on active levels and ignores silence and rare outliers',()=>{
 const points=Array.from({length:100},()=>({values:[-25,-24,-23]}));points.push({values:[-Infinity,-90,0]});
 const range=meter.historyRange(points);assert.ok(range.min<=-25&&range.max>=-23);assert.ok(range.max-range.min>=12);assert.ok(range.max-range.min<=18);assert.ok(range.min>-60);
 assert.deepEqual(meter.historyRange([{values:[-Infinity,-Infinity,-Infinity]}]),{min:-36,max:-6});
});
