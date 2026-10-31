const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function player(responses={}){
 const calls=[],elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',classList:{toggle(){}},addEventListener(){}});return elements.get(id)};
 const context={document:{getElementById:el,addEventListener(){}},window:{JJaIMsaePlayerBar:{bind(){},render(){}},JJaIMsaePlayerEQ:{bind(){},connect(a,s){return s}},__TAURI__:{core:{invoke:async(cmd,args)=>{calls.push([cmd,args]);if(cmd in responses)return responses[cmd];return cmd==='get_open_mode'?'existing':cmd==='load_playlist'?[]:cmd==='startup_media_files'?[]:''},convertFileSrc:x=>x}}},URLSearchParams,location:{search:''},setTimeout(){},crypto:require('node:crypto').webcrypto};
 const source=fs.readFileSync('src/app.js','utf8');
 vm.runInNewContext(source.slice(0,source.indexOf('document.addEventListener("keydown"'))+'globalThis.player=A;})();',context);
 const a=context.player;a.render=()=>{};a.msg=()=>{};return {a,calls,context};
}
test('existing window appends files and plays the requested track, including duplicates',async()=>{
 const {a}=player();a.tracks=[{path:'old.wav'}];let loaded;
 a.add=async paths=>{for(const path of paths)if(!a.tracks.some(t=>t.path===path))a.tracks.push({path})};a.load=async(n,auto)=>{loaded=[n,auto]};
 await a.receiveFiles(['new.WAV'],true);assert.equal(a.tracks.length,2);assert.deepEqual(loaded,[1,true]);
 await a.receiveFiles(['old.wav'],true);assert.equal(a.tracks.length,2);assert.deepEqual(loaded,[0,true]);
});
test('drop adds supported audio without interrupting playback and attaches subtitles',async()=>{
 const {a}=player();a.tracks=[{path:'old.wav'}];a.i=0;let loaded=false;a.load=async()=>loaded=true;a.add=async paths=>paths.forEach(path=>a.tracks.push({path}));a.loadSrt=async()=>{};
 await a.receiveFiles(['new.mp3','lyrics.srt','ignored.txt'],false);assert.equal(a.tracks.length,2);assert.equal(loaded,false);assert.equal(a.tracks[0].srt_path,'lyrics.srt');
});
test('isolated window does not overwrite the accumulated playlist',async()=>{
 const {a,calls}=player();a.isolated=true;await a.persist();assert.equal(calls.length,0);a.isolated=false;await a.persist();assert.equal(calls[0][0],'save_playlist');
});
test('isolated secondary window skips the saved playlist',async()=>{
 const {a,context}=player();context.location.search='?isolated=1';a.bind=()=>{};a.updateAB=()=>{};a.pollFiles=()=>{};a.load=async()=>{};
 await a.init();assert.equal(a.isolated,true);assert.equal(a.tracks.length,0);
});
test('first file launch in new mode discards saved tracks and autoplays the argument',async()=>{
 const {a,calls}=player({get_open_mode:'new',startup_media_files:['only.wav'],load_playlist:[{path:'old.wav'}]});
 a.bind=()=>{};a.updateAB=()=>{};a.pollFiles=()=>{};let played;
 a.add=async paths=>paths.forEach(path=>a.tracks.push({path}));a.load=async(n,auto)=>{played=[n,auto]};
 await a.init();assert.equal(a.isolated,true);assert.equal(a.tracks.length,1);assert.equal(a.tracks[0].path,'only.wav');assert.deepEqual(played,[0,true]);assert.equal(calls.some(([cmd])=>cmd==='load_playlist'),false);
});
test('first file launch in existing mode restores the accumulated playlist',async()=>{
 const {a}=player({startup_media_files:['new.wav'],load_playlist:[{path:'old.wav'}]});
 a.bind=()=>{};a.updateAB=()=>{};a.pollFiles=()=>{};a.add=async paths=>paths.forEach(path=>a.tracks.push({path}));let played;a.load=async(n,auto)=>{played=[n,auto]};
 await a.init();assert.equal(a.isolated,false);assert.equal(a.tracks.length,2);assert.deepEqual(played,[1,true]);
});

test('editor saves append song gallery paths and roll back metadata when playlist persistence fails',async()=>{
 const {a,context}=player();const track={id:'gallery',cover_path:'original.png'};a.tracks=[track];a.i=0;a.coverImage={};a.cover={style:{}};a.refreshSlides=()=>{};a.persist=async()=>{};let save;
 context.window.JJaIMsaeImageEditor={open:(target,callback)=>{assert.equal(target,track);save=callback}};
 context.document.getElementById('openImageEditor').onclick();await save('one.png');await save('two.png');assert.deepEqual(Array.from(track.cover_paths),['original.png','one.png','two.png']);assert.equal(track.cover_path,'two.png');
 a.persist=async()=>{throw Error('disk full')};await assert.rejects(save('three.png'));assert.equal(track.cover_path,'two.png');assert.deepEqual(Array.from(track.cover_paths),['original.png','one.png','two.png']);
});

test('native image drops route to the open image editor while audio files still enter the playlist',async()=>{
 const {a,context}=player();let imported,added;a.add=async paths=>added=paths;context.window.JJaIMsaeImageEditor={isOpen:()=>true,importPaths:async paths=>imported=paths};await a.receiveFiles(['cover.PNG','new.wav'],false);assert.deepEqual(Array.from(imported),['cover.PNG']);assert.deepEqual(Array.from(added),['new.wav']);
});

test('editor callback applies to the chosen song without replacing the currently playing cover',async()=>{
 const {a,context}=player(),source={id:'a',name:'A',cover_path:'a.png'},target={id:'b',name:'B',cover_path:'b.png'};a.tracks=[source,target];a.i=0;a.coverImage={src:'visible-a.png'};a.cover={style:{}};a.refreshSlides=()=>{};a.persist=async()=>{};let save,options;
 context.window.JJaIMsaeImageEditor={open:(track,callback,settings)=>{save=callback;options=settings}};context.document.getElementById('openImageEditor').onclick();assert.equal(options.getTracks(),a.tracks);await save('new-b.png','b');assert.equal(source.cover_path,'a.png');assert.equal(target.cover_path,'new-b.png');assert.equal(a.coverImage.src,'visible-a.png');assert.deepEqual(Array.from(target.cover_paths),['b.png','new-b.png']);await assert.rejects(save('orphan.png','removed'));
});

test('reveal uses the right-clicked track path and preserves playback selection',async()=>{
 const {a,calls}=player();a.tracks=[{path:'playing.wav',name:'Playing'},{path:'C:/Music/Other song.wav',name:'Other'}];a.i=0;let loaded=false;a.load=async()=>loaded=true;await a.revealTrack(1);assert.equal(calls.at(-1)[0],'reveal_media_file');assert.equal(calls.at(-1)[1].path,'C:/Music/Other song.wav');assert.equal(a.i,0);assert.equal(loaded,false);
});
test('reveal surfaces missing-file errors without interrupting playback',async()=>{
 const {a}=player({reveal_media_file:Promise.reject(Error('missing'))});a.tracks=[{path:'missing.wav',name:'Missing'}];a.i=0;let message;a.msg=value=>message=value;await a.revealTrack(0);assert.match(message,/파일 위치 열기 실패/);assert.equal(a.i,0);
});

test('image collection updates only the chosen song and rolls back all metadata on persistence failure',async()=>{
 const {a}=player();a.tracks=[{id:'a',name:'A',cover_path:'a.png'},{id:'b',name:'B',cover_path:'b.png'}];a.i=0;a.persist=async()=>{};await a.updateTrackImages('b',{cover_path:'c.png',cover_paths:['b.png','c.png'],slideshow:{interval:7,effect:'zoom'}});assert.equal(a.tracks[0].cover_path,'a.png');assert.equal(a.tracks[1].slideshow.effect,'zoom');assert.equal(a.i,0);a.persist=async()=>{throw Error('full')};await assert.rejects(a.updateTrackImages('b',{cover_path:null,cover_paths:[],slideshow:{effect:'cut'}}));assert.equal(a.tracks[1].cover_path,'c.png');assert.equal(a.tracks[1].slideshow.effect,'zoom');assert.equal(a.trackImages(a.tracks[1]).length,2);
});

test('spectrum byte scale ends at actual zero decibels for the dashed reference line',()=>{const {a,context}=player();const analyser={frequencyBinCount:1024,connect(){}};context.window.AudioContext=class{createMediaElementSource(){return {connect(){}}}createAnalyser(){return analyser}};a.graph();assert.equal(analyser.minDecibels,-100);assert.equal(analyser.maxDecibels,0);assert.equal(analyser.fftSize,2048)});


test('mastering takes playback ownership before asynchronous loading and blocks delayed player resume',async()=>{
 const {a,context}=player();let paused=0,played=0,release;
 a.i=0;a.a={pause(){paused++},play(){played++;return Promise.resolve()}};
 a.graph=()=>{};a.ctx={state:'suspended',resume:()=>new Promise(resolve=>release=resolve)};
 const pending=a.go();
 context.document.body={classList:{add(){}}};
 a.masteringPanel={hidden:true};let frameSrc='loaded',reloads=0;a.masteringFrame={get src(){return frameSrc},set src(value){frameSrc=value;reloads++;queueMicrotask(()=>this.onload())},dataset:{src:'./mastering/index.html'},contentWindow:{}};context.clearTimeout=()=>{};
 const opening=a.showMastering(false);
 assert.equal(paused,1);assert.equal(a.masteringActive,true);
 release();await pending;await opening;assert.equal(reloads,1);await a.go();assert.equal(played,0);
});

test('sending a track to mastering pauses before preparing the track and releases ownership on failure',async()=>{
 const {a}=player({prepare_mastering:Promise.reject(new Error('failed'))});
 a.i=0;a.tracks=[{}];let paused=0;a.a={pause(){paused++}};
 await a.master();assert.equal(paused,1);assert.equal(a.masteringActive,false);
});
