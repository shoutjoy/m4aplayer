/* Adjustable playlist width, saved locally without changing project files. */
(()=>{
'use strict';
const workspace=document.querySelector('.workspace'),handle=document.getElementById('sidebarResize');
if(!workspace||!handle)return;
const storageKey='jjaimsae.sidebar.width',minimum=200;
const defaultWidth=()=>window.innerWidth<=900?320:480;
const maximum=()=>Math.max(minimum,Math.min(620,Math.floor(workspace.getBoundingClientRect().width-420)));
let preferred=defaultWidth(),width=preferred,drag=null,frame=0;
try{const saved=localStorage.getItem(storageKey);if(saved!==null&&Number.isFinite(Number(saved))&&Number(saved)>=minimum)preferred=Number(saved)}catch{}
function apply(value,notify=true){width=Math.round(Math.max(minimum,Math.min(maximum(),value)));workspace.style.setProperty('--sidebar-width',width+'px');handle.setAttribute('aria-valuemin',minimum);handle.setAttribute('aria-valuemax',maximum());handle.setAttribute('aria-valuenow',width);handle.setAttribute('aria-valuetext',width+' 픽셀');if(notify&&!frame)frame=requestAnimationFrame(()=>{frame=0;window.dispatchEvent(new Event('resize'))})}
function save(){try{localStorage.setItem(storageKey,String(preferred))}catch{}}
handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();drag={pointer:event.pointerId,x:event.clientX,width};handle.setPointerCapture(event.pointerId);document.body.classList.add('sidebar-resizing')};
handle.onpointermove=event=>{if(!drag||drag.pointer!==event.pointerId)return;apply(drag.width+event.clientX-drag.x);preferred=width};
function finish(event){if(!drag||drag.pointer!==event.pointerId)return;drag=null;document.body.classList.remove('sidebar-resizing');save()}
handle.onpointerup=finish;handle.onpointercancel=finish;handle.onlostpointercapture=finish;
handle.ondblclick=()=>{preferred=defaultWidth();apply(preferred);preferred=width;save()};
handle.onkeydown=event=>{const step=event.shiftKey?50:10;let next;if(event.key==='ArrowLeft')next=width-step;else if(event.key==='ArrowRight')next=width+step;else if(event.key==='Home')next=minimum;else if(event.key==='End')next=maximum();else if(event.key==='Enter')next=defaultWidth();else return;event.preventDefault();apply(next);preferred=width;save()};
window.addEventListener('resize',()=>apply(preferred,false));apply(preferred,false);
})();
