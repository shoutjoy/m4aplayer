(()=>{
'use strict';
const select=document.getElementById('vizMode'),toggle=document.getElementById('spreadVisualStyles'),panel=document.getElementById('visualStyleButtons');
if(!select||!toggle||!panel)return;
const labels={'bar':'▥ 막대','wave':'∿ 웨이브','both':'▥∿ 막대·웨이브','slides':'▧ 이미지','bar-slides':'▥▧ 막대·이미지','loudness':'◉ 사이트 LUFS','loudness-view':'⌁ LUFS View','bar-loudness':'▥◉ 막대·LUFS','bar-history-loudness':'▥⌁◉ 막대·히스토리·타겟'};
for(const option of select.options){const button=document.createElement('button');button.type='button';button.dataset.mode=option.value;button.textContent=labels[option.value]||option.textContent;button.title=option.textContent;button.setAttribute('aria-label',option.textContent);button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}))};panel.append(button)}
function sync(){for(const button of panel.children){const active=button.dataset.mode===select.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))}}
select.addEventListener('change',sync);
toggle.onclick=()=>{panel.hidden=!panel.hidden;select.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));toggle.title=panel.hidden?'보기 버튼 펼치기':'보기 버튼 접기';toggle.textContent=panel.hidden?'▦ Spread':'▴ 접기';sync()};toggle.onclick();select.dispatchEvent(new Event('change',{bubbles:true}));
})();
