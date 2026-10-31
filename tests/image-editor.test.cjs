const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../src/image-editor-core.js');
const P=require('../src/image-paint.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function editor(saved=null,records=new Map(),versions={}){
 const elements=new Map(),calls=[],draws=[],adjust=[],clear=[];let dbFailure=false,clipboardItems=[],aiOptions;
 function element(tag='div'){
  const result={tagName:tag.toUpperCase(),value:'',textContent:'',hidden:false,disabled:false,min:'',max:'',step:'1',dataset:{},style:{},selectedOptions:[{}],clientWidth:640,clientHeight:640,offsetLeft:0,offsetTop:0,classList:{add(){},remove(){},toggle(){}},listeners:{},addEventListener(name,handler){this.listeners[name]=handler},contains(){return false},replaceChildren(...children){this.children=children;if(children.length)this.value=children[0].value},click(){return this.onclick?.()},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:640,height:640}},toDataURL(){return 'data:image/png;base64,iVBORw0KGgo='},toBlob(fn,type='image/png'){calls.push(['pngSize',this.width,this.height,type]);fn(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type}))}};
  const context=new Proxy({measureText:text=>({width:text.length*60}),createRadialGradient:()=>({addColorStop(){}}),getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)})},{get(t,key){return t[key]??((...args)=>draws.push([key,...args]))},set(t,k,v){t[k]=v;return true}});result.getContext=()=>context;return result;
 }
 const dialog=element();Object.defineProperty(dialog,'innerHTML',{set(html){for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const el=element(m[1]);for(const a of m[0].matchAll(/\b(value|min|max|step)="([^"]*)"/g))el[a[1]]=a[2];elements.set('#'+m[2],el)}for(const m of html.matchAll(/data-adjust="([^"]+)" data-delta="([^"]+)"/g)){const button=element('button');button.dataset={adjust:m[1],delta:m[2]};adjust.push(button)}for(const m of html.matchAll(/data-clear="([^"]+)" data-value="([^"]+)"/g)){const button=element('button');button.dataset={clear:m[1],value:m[2]};clear.push(button)}}});
 const wrap=element();dialog.querySelector=key=>key==='.ie-canvas-wrap'?wrap:elements.get(key)||null;dialog.querySelectorAll=key=>key==='[data-adjust]'?adjust:key==='[data-clear]'?clear:[];dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 const database={transaction(){const tx={objectStore(){function request(action){const req={};queueMicrotask(()=>{if(dbFailure){tx.error=Error('QuotaExceededError');tx.onabort?.();return}req.result=action();req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return req}return {get:key=>request(()=>records.get(key)),getAll:()=>request(()=>[...records.values()]),put:record=>request(()=>records.set(record.id,structuredClone(record)))}}};return tx}};
 const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=database;req.onsuccess()});return req}};
 class FakeImage{constructor(){this.width=800;this.height=600}set src(value){this.data=value;queueMicrotask(()=>this.onload())}}
 class Reader{async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload()}}
 class Worker{postMessage(data){queueMicrotask(()=>this.onmessage({data:{id:data.id,buffer:C.applyTone(new Uint8ClampedArray(data.buffer),data.width,data.height,data.tones).buffer}}))}terminate(){}}
 const context={window:{AIStudioImages:{open:options=>{aiOptions=options},openSettings:()=>{}},ArtworkCore:C,ArtworkPaint:P,indexedDB,__TAURI__:{core:{invoke:async(cmd,args)=>{calls.push([cmd,args]);if(cmd==='load_cover_version')return versions[args.path]||null;if(cmd==='load_cover_edit')return saved;if(cmd==='read_binary')return [137,80,78,71,13,10,26,10];if(cmd==='pick_cover_file')return 'original.png';if(cmd==='save_cover_edit')return 'edited.png';if(cmd==='export_cover_image')return 'export.'+args.format;if(cmd==='save_image_project')return 'song.jjimg';if(cmd==='open_image_project')return {...C.defaults(),sourceData:'data:image/png;base64,iVBORw0KGgo=',layers:[{...C.layerDefaults(),text:'Imported'}]}}}}},document:{currentScript:{src:'http://localhost/src/image-editor.js'},body:{append(){}},createElement:tag=>tag==='dialog'?dialog:element(tag),fonts:{ready:Promise.resolve()}},navigator:{clipboard:{read:async()=>clipboardItems}},requestAnimationFrame:fn=>{queueMicrotask(fn);return 1},setTimeout:()=>1,clearTimeout(){},Blob,FileReader:Reader,Image:FakeImage,Worker,URL,fetch,Uint8Array,Uint8ClampedArray,structuredClone,console};
 vm.runInNewContext(fs.readFileSync('src/image-editor.js','utf8'),context);
 return {open:context.window.JJaIMsaeImageEditor.open,el:id=>elements.get('#ie'+id),calls,draws,dialog,adjust,clear,records,api:context.window.JJaIMsaeImageEditor,aiOptions:()=>aiOptions,setClipboard:items=>clipboardItems=items,failDB:()=>dbFailure=true};
}
test('all aspect ratios export actual selected pixel dimensions and formats',async()=>{
 const e=editor();await e.open({id:'one',name:'song',cover_path:'original.png'},()=>{});await tick();
 for(const [ratio,size,expected] of [['1:1',1600,[1600,1600]],['1:1',3000,[3000,3000]],['3:4',1600,[1200,1600]],['9:16',1600,[900,1600]],['4:3',3000,[3000,2250]],['16:9',1600,[1600,900]]]){
  e.el('Ratio').value=ratio;e.el('Ratio').oninput();e.el('Size').value=size;e.el('Size').oninput();e.el('Format').value='png';await e.el('Export').onclick();
  assert.deepEqual(e.calls.filter(c=>c[0]==='pngSize').at(-1).slice(1,3),expected);
 }
 for(const format of ['png','jpeg','jpg','webp','svg','gif']){e.el('Format').value=format;await e.el('Export').onclick();assert.equal(e.calls.filter(c=>c[0]==='export_cover_image').at(-1)[1].format,format)}
});
test('text input, slider and minus/plus controls stay synchronized',async()=>{
 const e=editor();await e.open({id:'a',name:'A',cover_path:'original.png'},()=>{});e.el('AddText').onclick();
 e.el('FontSizeRange').value='200';e.el('FontSizeRange').oninput();assert.equal(e.el('FontSize').value,200);
 e.adjust.find(b=>b.dataset.adjust==='FontSize'&&b.dataset.delta==='1').onclick();assert.equal(e.el('FontSize').value,201);assert.equal(e.el('FontSizeRange').value,201);
 e.el('FontSize').value='90';e.el('FontSize').oninput();assert.equal(e.el('FontSizeRange').value,90);
 e.el('Text').value='Title\nArtist';e.el('Text').oninput();e.el('Rotation').value='45';e.el('Rotation').oninput();await tick();
 assert.ok(e.draws.some(d=>d[0]==='rotate'&&d[1]===Math.PI/4));assert.ok(e.draws.some(d=>d[0]==='fillText'&&d[1]==='Artist'));
});
test('mouse dragging text changes position, corner size and rotation in output coordinates',async()=>{
 const e=editor();await e.open({id:'a',name:'A',cover_path:'original.png'},()=>{});e.el('AddText').onclick();await tick();const overlay=e.el('Handles');
 overlay.onpointerdown({clientX:320,clientY:320,pointerId:1,preventDefault(){}});overlay.onpointermove({clientX:384,clientY:384});overlay.onpointerup();await tick();assert.equal(Number(e.el('TextX').value),60);assert.equal(Number(e.el('TextY').value),60);
 // A three-letter default title is 240 output pixels wide in this test context.
 const width=240;const x=384+width/2*.4,y=384+72*.4;
 overlay.onpointerdown({clientX:x,clientY:y,pointerId:1,preventDefault(){}});overlay.onpointermove({clientX:384+(x-384)*1.5,clientY:384+(y-384)*1.5});overlay.onpointerup();await tick();assert.ok(Number(e.el('FontSize').value)>120);
 const size=Number(e.el('FontSize').value),top=384-size*1.2/2*.4-30;
 overlay.onpointerdown({clientX:384,clientY:top,pointerId:1,preventDefault(){}});overlay.onpointermove({clientX:384+(384-top),clientY:384});overlay.onpointerup();await tick();assert.ok(Math.abs(Number(e.el('Rotation').value)-90)<1);
});
test('IndexedDB restores portable state across editor instances, including source and tone',async()=>{
 const records=new Map(),e=editor(null,records);await e.open({id:'a',name:'Song',cover_path:'original.png'},()=>{});e.el('AddText').onclick();e.el('Text').value='Saved';e.el('Text').oninput();e.el('Brightness').value=20;e.el('Brightness').oninput();await e.el('SaveInternal').onclick();assert.match(records.get('a').project.sourceData,/^data:image\/png;base64,/);
 const other=editor(null,records);await other.open({id:'a',name:'Song',cover_path:'original.png'},()=>{});assert.equal(other.el('Text').value,'Saved');assert.equal(other.el('Brightness').value,20);
 await other.el('SaveProject').onclick();const portable=other.calls.find(c=>c[0]==='save_image_project')[1].project;assert.equal(portable.layers[0].text,'Saved');assert.ok(portable.sourceData);
 await other.el('OpenProject').onclick();assert.equal(other.el('Text').value,'Imported');
});
test('failed internal save is surfaced; missing cover and cancelled operations remain usable',async()=>{
 const e=editor();await e.open({id:'a',name:'A'},()=>{});await tick();assert.equal(e.el('Apply').disabled,true);await e.el('Upload').onclick();await tick();assert.equal(e.el('Apply').disabled,false);e.failDB();await e.el('SaveInternal').onclick();assert.match(e.el('DBStatus').textContent,/QuotaExceededError/);assert.equal(e.el('SaveProject').disabled,false);
});
test('applying retains original data and targets the captured track; undo preserves editable layers',async()=>{
 const e=editor();let applied;await e.open({id:'a',name:'A',cover_path:'original.png'},path=>applied=path);e.el('AddText').onclick();await e.el('Apply').onclick();assert.equal(applied,'edited.png');const save=e.calls.find(c=>c[0]==='save_cover_edit')[1];assert.equal(save.trackId,'a');assert.ok(save.sourceBytes.length);assert.ok(save.project.sourceData);
 e.el('DeleteText').onclick();assert.equal(e.el('TextControls').hidden,true);await e.el('Undo').onclick();assert.equal(e.el('TextControls').hidden,false);await e.el('Redo').onclick();assert.equal(e.el('TextControls').hidden,true);
});

test('wheel zoom keeps the image pixel under the cursor fixed, with bounded zoom and unchanged output resolution',async()=>{
 const e=editor();await e.open({id:'wheel',name:'Wheel',cover_path:'original.png'},()=>{});await tick();
 const overlay=e.el('Handles');let prevented=0,stopped=0;
 const before=C.imagePlacement(800,600,1600,1600,C.defaults()),point={x:400,y:600};
 overlay.onwheel({clientX:160,clientY:240,deltaY:-100,deltaMode:0,preventDefault(){prevented++},stopPropagation(){stopped++}});await tick();await e.el('SaveInternal').onclick();
 const p=e.records.get('wheel').project,after=C.imagePlacement(800,600,1600,1600,p);
 assert.ok(p.zoom>1);assert.ok(Math.abs((point.x-before.x)/before.width-(point.x-after.x)/after.width)<1e-9);assert.ok(Math.abs((point.y-before.y)/before.height-(point.y-after.y)/after.height)<1e-9);
 assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(p.size,1600);assert.equal(e.el('Zoom').value,Math.round(p.zoom*100)/100);
 for(let i=0;i<50;i++)overlay.onwheel({clientX:320,clientY:320,deltaY:-1000,deltaMode:0,preventDefault(){},stopPropagation(){}});
 assert.equal(Number(e.el('Zoom').value),5);
 for(let i=0;i<50;i++)overlay.onwheel({clientX:320,clientY:320,deltaY:1000,deltaMode:0,preventDefault(){},stopPropagation(){}});
 assert.equal(Number(e.el('Zoom').value),.1);
});
test('dragging the image moves in canvas coordinates, persists and supports undo at an exactly fitted size',async()=>{
 const e=editor();await e.open({id:'pan',name:'Pan',cover_path:'original.png'},()=>{});await tick();const overlay=e.el('Handles');
 const before=e.draws.filter(d=>d[0]==='drawImage'&&d.length===6).at(-1);
 overlay.onpointerdown({clientX:40,clientY:40,pointerId:1,button:0,preventDefault(){}});overlay.onpointermove({clientX:104,clientY:104});overlay.onpointerup();await tick();
 assert.equal(Number(e.el('ImageX').value),10);assert.equal(Number(e.el('ImageY').value),10);assert.equal(e.records.get('pan').project.panX,10);
 const after=e.draws.filter(d=>d[0]==='drawImage'&&d.length===6).at(-1);assert.ok(Math.abs(after[2]-before[2]-64)<1e-6);assert.ok(Math.abs(after[3]-before[3]-64)<1e-6);
 await e.el('Undo').onclick();assert.equal(Number(e.el('ImageX').value),0);assert.equal(Number(e.el('ImageY').value),0);
});
test('Alt-drag can move the image from over text without moving the text itself',async()=>{
 const e=editor();await e.open({id:'alt-pan',name:'Pan',cover_path:'original.png'},()=>{});e.el('AddText').onclick();await tick();const overlay=e.el('Handles');
 overlay.onpointerdown({clientX:320,clientY:320,pointerId:1,button:0,altKey:true,preventDefault(){}});overlay.onpointermove({clientX:384,clientY:320});overlay.onpointerup();await tick();const p=e.records.get('alt-pan').project;
 assert.equal(p.panX,10);assert.equal(p.layers[0].x,50);assert.equal(p.layers[0].y,50);
});

test('C controls zero valid adjustments and restore safe defaults for positive-only sizes',async()=>{
 const e=editor();await e.open({id:'reset',name:'Reset',cover_path:'original.png'},()=>{});e.el('AddText').onclick();
 for(const [id,value,expected] of [['Brightness',75,0],['ImageX',25,0],['ImageRotation',90,0],['ShadowBlur',40,0],['Zoom',2,1],['Size',3000,1600],['FontSize',300,120],['Gamma',2,1]]){e.el(id).value=value;e.el(id).oninput();e.clear.find(b=>b.dataset.clear===id).onclick();assert.equal(Number(e.el(id).value),expected);assert.equal(Number(e.el(id+'Range').value),expected)}
});
test('image rotation and flips affect rendering and persist independently from text transforms',async()=>{
 const e=editor();await e.open({id:'transform',name:'Transform',cover_path:'original.png'},()=>{});e.el('AddText').onclick();e.el('ImageRotation').value=90;e.el('ImageRotation').oninput();e.el('FlipX').onclick();await tick();await e.el('SaveInternal').onclick();const p=e.records.get('transform').project;
 assert.equal(p.imageRotation,90);assert.equal(p.flipX,true);assert.equal(p.layers[0].rotation,0);assert.ok(e.draws.some(d=>d[0]==='rotate'&&d[1]===Math.PI/2));assert.ok(e.draws.some(d=>d[0]==='scale'&&d[1]===-1&&d[2]===1));assert.equal(e.el('FlipX').ariaPressed,'true');
 await e.el('Undo').onclick();assert.equal(e.el('FlipX').ariaPressed,'false');assert.equal(Number(e.el('ImageRotation').value),90);
});
test('reset all retains the image, clears text and adjustments, persists and is undoable',async()=>{
 const e=editor();await e.open({id:'all',name:'All',cover_path:'original.png'},()=>{});e.el('AddText').onclick();e.el('Brightness').value=40;e.el('Brightness').oninput();e.el('Zoom').value=2;e.el('Zoom').oninput();e.el('FlipX').onclick();e.el('ResetAll').onclick();await e.el('SaveInternal').onclick();const p=e.records.get('all').project;
 assert.ok(p.sourceData);assert.equal(p.sourcePath,'original.png');assert.equal(p.layers.length,0);assert.equal(p.zoom,1);assert.equal(p.tones.brightness,0);assert.equal(p.flipX,false);assert.equal(p.imageRotation,0);assert.equal(e.el('TextControls').hidden,true);
 await e.el('Undo').onclick();assert.equal(e.el('TextControls').hidden,false);assert.equal(Number(e.el('Zoom').value),2);assert.equal(Number(e.el('Brightness').value),40);assert.equal(e.el('FlipX').ariaPressed,'true');
});

test('brush and eraser strokes preserve layer isolation, alpha, thickness and undo history',async()=>{
 const e=editor();await e.open({id:'paint',name:'Paint',cover_path:'original.png'},()=>{});e.el('PaintTool').value='brush';e.el('PaintTool').onchange();e.el('BrushAlpha').value=45;e.el('BrushAlpha').oninput();e.el('BrushSize').value=100;e.el('BrushSize').oninput();const overlay=e.el('Handles');
 overlay.onpointerdown({clientX:100,clientY:100,button:0,pointerId:1,preventDefault(){}});overlay.onpointermove({clientX:150,clientY:150});overlay.onpointerup();await tick();await e.el('SaveInternal').onclick();let p=e.records.get('paint').project;
 assert.equal(p.paintLayers.length,1);assert.equal(p.paintLayers[0].strokes[0].opacity,.45);assert.equal(p.paintLayers[0].strokes[0].size,100/1600);assert.equal(p.paintLayers[0].strokes[0].points.length,2);assert.equal(p.baseErase.length,0);
 e.el('PaintTool').value='eraser';e.el('PaintTool').onchange();overlay.onpointerdown({clientX:100,clientY:100,button:0,pointerId:1,preventDefault(){}});overlay.onpointerup();await tick();await e.el('SaveInternal').onclick();p=e.records.get('paint').project;assert.equal(p.paintLayers[0].strokes[1].tool,'eraser');assert.equal(p.baseErase.length,0);
 e.el('PaintLayer').value=-1;e.el('PaintLayer').onchange();overlay.onpointerdown({clientX:200,clientY:200,button:0,pointerId:1,preventDefault(){}});overlay.onpointerup();await tick();await e.el('SaveInternal').onclick();assert.equal(e.records.get('paint').project.baseErase.length,1);
 await e.el('Undo').onclick();await e.el('SaveInternal').onclick();assert.equal(e.records.get('paint').project.baseErase.length,0);
});
test('Ctrl-picked clone stamp persists its source and destination offset in a new paint layer',async()=>{
 const e=editor();await e.open({id:'clone',name:'Clone',cover_path:'original.png'},()=>{});e.el('PaintTool').value='clone';e.el('PaintTool').onchange();const overlay=e.el('Handles');
 overlay.onpointerdown({clientX:100,clientY:100,button:0,pointerId:1,preventDefault(){}});assert.match(e.el('Status').textContent,/Ctrl/);
 overlay.onpointerdown({clientX:100,clientY:100,button:0,pointerId:1,ctrlKey:true,preventDefault(){}});await tick();
 overlay.onpointerdown({clientX:300,clientY:300,button:0,pointerId:1,preventDefault(){}});overlay.onpointermove({clientX:330,clientY:330});overlay.onpointerup();await tick();await e.el('SaveInternal').onclick();const p=e.records.get('clone').project,s=p.paintLayers[0].strokes[0];
 assert.equal(s.tool,'clone');assert.ok(p.paintSources[s.sourceId].startsWith('data:image/png;base64,'));assert.equal(s.offsetX,200/640);assert.equal(s.offsetY,200/640);assert.equal(s.points.length,2);
});
test('apply-and-close appends multiple gallery images and saves the editable internal project before closing',async()=>{
 const e=editor(),track={id:'gallery',name:'Gallery',cover_path:'original.png',cover_paths:[]};let index=0;const apply=async()=>{const path='cover-'+(++index)+'.png';track.cover_paths.push(path);track.cover_path=path};await e.open(track,apply);e.el('AddPaintLayer').onclick();await e.el('Apply').onclick();assert.equal(e.dialog.open,true);await e.el('ApplyClose').onclick();assert.equal(e.dialog.open,false);assert.equal(track.cover_paths.length,2);assert.equal(e.records.get('gallery').project.paintLayers.length,1);assert.equal(e.calls.filter(c=>c[0]==='save_cover_edit').length,2);
});
test('apply-and-close keeps editor open when internal project persistence fails',async()=>{
 const e=editor();await e.open({id:'failure',name:'Failure',cover_path:'original.png'},()=>{});e.failDB();await e.el('ApplyClose').onclick();assert.equal(e.dialog.open,true);assert.match(e.el('Status').textContent,/실패/);
});

test('expanded tool buttons select tools and update the active button',async()=>{
 const e=editor();await e.open({id:'tools',name:'Tools',cover_path:'original.png'},()=>{});e.el('ToolEraser').onclick();assert.equal(e.el('PaintTool').value,'eraser');assert.equal(e.el('ToolEraser').ariaPressed,'true');assert.equal(e.el('ToolSelect').ariaPressed,'false');e.el('ToolBrush').onclick();assert.equal(e.el('PaintTool').value,'brush');assert.equal(e.el('ToolEraser').ariaPressed,'false');assert.equal(e.el('ToolBrush').ariaPressed,'true');
});
test('remove image preserves text and paint layers, persists blank source and supports undo',async()=>{
 const records=new Map(),e=editor(null,records);await e.open({id:'remove',name:'Remove',cover_path:'original.png'},()=>{});e.el('AddText').onclick();e.el('AddPaintLayer').onclick();e.el('RemoveImage').onclick();await tick();await e.el('SaveInternal').onclick();const p=records.get('remove').project;assert.equal(p.sourceData,'');assert.equal(p.sourcePath,'');assert.equal(p.layers.length,1);assert.equal(p.paintLayers.length,1);assert.equal(e.el('Apply').disabled,true);await e.el('Undo').onclick();await tick();assert.equal(e.el('Apply').disabled,false);
 const restored=editor(null,records);e.el('RemoveImage').onclick();await e.el('SaveInternal').onclick();await restored.open({id:'remove',name:'Remove',cover_path:'original.png'},()=>{});await tick();assert.equal(restored.el('Apply').disabled,true);assert.equal(restored.calls.filter(c=>c[0]==='read_binary').length,0);
});
test('file drop and image paste load embedded sources while ordinary text paste is untouched',async()=>{
 const e=editor();await e.open({id:'transfer',name:'Transfer'},()=>{});const file=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});let prevented=0;const event=data=>({dataTransfer:data,clipboardData:data,preventDefault(){prevented++},stopPropagation(){}});
 e.dialog.listeners.drop(event({files:[file],items:[]}));await tick();await e.el('SaveInternal').onclick();assert.match(e.records.get('transfer').project.sourceData,/^data:image\/png;base64,/);assert.equal(prevented,1);
 e.el('RemoveImage').onclick();e.dialog.listeners.paste(event({files:[],items:[{kind:'file',getAsFile:()=>file}]}));await tick();assert.equal(e.el('Apply').disabled,false);assert.equal(prevented,2);
 e.dialog.listeners.paste(event({files:[],items:[{kind:'string',type:'text/plain'}]}));assert.equal(prevented,2);
});
test('paste button reads supported clipboard images and native drag paths import in the open editor',async()=>{
 const e=editor();assert.equal(await e.api.importPaths(['cover.png']),false);await e.open({id:'native',name:'Native'},()=>{});e.setClipboard([{types:['image/png'],getType:async()=>new Blob(['image'],{type:'image/png'})}]);await e.el('PasteImage').onclick();await tick();assert.equal(e.el('Apply').disabled,false);assert.equal(await e.api.importPaths(['ignored.txt']),false);assert.equal(await e.api.importPaths(['new-cover.jpg']),true);await e.el('SaveInternal').onclick();assert.equal(e.records.get('native').project.sourcePath,'new-cover.jpg');
});

test('AI integration captures an editable composite, applies a separate result and restores original layers on undo',async()=>{
 const e=editor();await e.open({id:'ai-edit',name:'AI edit',cover_path:'original.png'},()=>{});e.el('AddText').onclick();e.el('AddPaintLayer').onclick();e.el('AI').onclick();const options=e.aiOptions();assert.equal(options.track.id,'ai-edit');assert.equal(options.hasImage,true);assert.match(await options.getImage(),/^data:image\/jpeg;base64,/);
 await options.apply({path:'ai-result.png',aspect_ratio:'3:4'});await e.el('SaveInternal').onclick();let p=e.records.get('ai-edit').project;assert.equal(p.sourcePath,'ai-result.png');assert.equal(p.ratio,'3:4');assert.equal(p.layers.length,0);assert.equal(p.paintLayers.length,0);
 await e.el('Undo').onclick();await e.el('SaveInternal').onclick();p=e.records.get('ai-edit').project;assert.equal(p.sourcePath,'original.png');assert.equal(p.layers.length,1);assert.equal(p.paintLayers.length,1);
});

test('selected target song receives its own image and project while the source draft remains independent',async()=>{
 const e=editor(),source={id:'source',name:'Source',cover_path:'original.png'},target={id:'target',name:'Target',cover_path:'target-old.png'};let applied;
 await e.open(source,async(path,id)=>{applied=id;target.cover_path=path},{getTracks:()=>[source,target]});assert.equal(e.el('TargetTrack').value,'source');e.el('AddText').onclick();e.el('TargetTrack').value='target';await e.el('Apply').onclick();
 assert.equal(applied,'target');assert.equal(e.calls.find(c=>c[0]==='save_cover_edit')[1].trackId,'target');assert.equal(e.records.get('target').project.layers.length,1);assert.equal(e.records.get('target').project.outputPath,'edited.png');assert.equal(e.records.get('source').project.outputPath,undefined);assert.equal(source.cover_path,'original.png');assert.equal(e.dialog.open,true);
});
test('apply-and-close also honors the selected destination song',async()=>{
 const e=editor(),source={id:'a',name:'A',cover_path:'original.png'},target={id:'b',name:'B'};let id;
 await e.open(source,async(path,destination)=>{id=destination;target.cover_path=path},{getTracks:()=>[source,target]});e.el('TargetTrack').value='b';await e.el('ApplyClose').onclick();assert.equal(id,'b');assert.equal(e.dialog.open,false);assert.ok(e.records.has('b'));assert.ok(e.records.has('a'));
});
test('removed target is rejected and newly added songs appear when focusing the destination selector',async()=>{
 const e=editor(),source={id:'a',name:'A',cover_path:'original.png'},target={id:'b',name:'B'};let choices=[source,target];await e.open(source,async()=>{},{getTracks:()=>choices});e.el('TargetTrack').value='b';choices=[source];await e.el('Apply').onclick();assert.equal(e.calls.filter(c=>c[0]==='save_cover_edit').length,0);assert.match(e.el('Status').textContent,/곡을 선택/);assert.equal(e.el('TargetTrack').value,'');choices.push({id:'c',name:'C'});e.el('TargetTrack').onfocus();assert.ok(e.el('TargetTrack').children.some(option=>option.value==='c'));assert.equal(e.el('TargetTrack').value,'');
});

test('restored portable image editing state takes precedence over an older local track project',async()=>{
 const original={...C.defaults('old.png'),outputPath:'old.png',sourceData:'data:image/png;base64,iVBORw0KGgo=',layers:[{...C.layerDefaults(),text:'Old local'}]},restored={...C.defaults(''),outputPath:'restored.png',sourceData:'data:image/png;base64,iVBORw0KGgo=',layers:[{...C.layerDefaults(),text:'Portable edit'}]};const e=editor(original,new Map(),{'restored.png':restored});await e.open({id:'same-track',name:'Song',cover_path:'restored.png'},()=>{});assert.equal(e.el('Text').value,'Portable edit');assert.equal(e.calls.filter(c=>c[0]==='load_cover_edit').length,0);
});
