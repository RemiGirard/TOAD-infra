
for(const root of document.querySelectorAll('[data-monitor]')){
 const tabs=[...root.querySelectorAll('[data-monitor-tab]')];
 function select(tab,save=true){for(const candidate of tabs){const active=candidate===tab;candidate.setAttribute('aria-selected',String(active));candidate.tabIndex=active?0:-1;root.querySelector('#'+candidate.getAttribute('aria-controls')).hidden=!active;}if(save&&!root.hasAttribute('data-example'))history.replaceState(null,'','#view='+tab.dataset.monitorTab);}
 if(!root.hasAttribute('data-example')){const initial=tabs.find(tab=>tab.dataset.monitorTab===new URLSearchParams(location.hash.slice(1)).get('view'));if(initial)select(initial,false);}
 for(const tab of tabs){tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{let index=tabs.indexOf(tab);if(event.key==='ArrowRight')index=(index+1)%tabs.length;else if(event.key==='ArrowLeft')index=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;event.preventDefault();select(tabs[index]);tabs[index].focus();});}
 const freshness=root.querySelector('[data-expiry]');
 if(freshness&&!root.hasAttribute('data-example')){const update=()=>{if(Date.now()>Date.parse(freshness.dataset.expiry)){freshness.dataset.stale='true';freshness.textContent='Stale evidence — refresh before acting';}};update();setInterval(update,1000);}
}
for(const group of document.querySelectorAll('[data-monitor-examples]'))for(const button of group.querySelectorAll('[data-monitor-scenario]'))button.addEventListener('click',()=>{for(const candidate of group.querySelectorAll('[data-monitor-scenario]'))candidate.setAttribute('aria-pressed',String(candidate===button));for(const example of group.querySelectorAll('[data-monitor-example]'))example.hidden=example.dataset.monitorExample!==button.dataset.monitorScenario;});
