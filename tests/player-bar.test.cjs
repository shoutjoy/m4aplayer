const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('cue shortcut saves per track, marker starts playback and deletion removes selection',()=>{
 const nodes={},listeners={},storage=new Map();const node=()=>({style:{},children:[],replaceChildren(){this.children=[]},append(b){this.children.push(b)},setAttribute(){},classList:{toggle(){}}});
 const document={getElementById:id=>nodes[id]??=node(),createElement:node,addEventListener:(n,f)=>listeners[n]=f,querySelector:()=>null};
 const window={};vm.runInNewContext(fs.readFileSync('src/player-bar.js','utf8'),{window,document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:{randomUUID:()=>String(storage.size+1)}});
 let plays=0;const a={tracks:[{path:'song-a'},{path:'song-b'}],i:0,a:{duration:100,currentTime:25,addEventListener(){}},tm:String,msg(){},go(){plays++},progress(){window.JJaIMsaePlayerBar.render(this)},updateAB(){},abOn:true};window.JJaIMsaePlayerBar.bind(a);
 const press=(extra={})=>listeners.keydown({code:'KeyM',target:{tagName:'BODY'},preventDefault(){},...extra});press();assert.equal(nodes.cueMarkers.children.length,1);assert.equal(nodes.cueMarkers.children[0].style.left,'25%');
 a.a.currentTime=0;nodes.cueMarkers.children[0].onclick({stopPropagation(){}});assert.equal(a.a.currentTime,25);assert.equal(plays,1);assert.equal(a.abOn,false);
 press({target:{tagName:'INPUT'}});assert.equal(nodes.cueMarkers.children.length,1);a.i=1;window.JJaIMsaePlayerBar.render(a);assert.equal(nodes.cueMarkers.children.length,0);a.i=0;window.JJaIMsaePlayerBar.render(a);assert.equal(nodes.cueMarkers.children.length,1);nodes.cueMarkers.children[0].onclick({stopPropagation(){}});nodes.deleteCue.onclick();assert.equal(nodes.cueMarkers.children.length,0);
});
