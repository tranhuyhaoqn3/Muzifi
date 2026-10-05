(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=new class{constructor(){this.state={isAuthenticated:!1,activeTab:`library`,tracks:[],totalTracks:0,libraryFilter:`all`,searchQuery:``,sortBy:`created_desc`,playlists:[],activePlaylist:null,jobs:[],activeJobsCount:0,currentTrack:null,queue:[],originalQueue:[],isPlaying:!1,currentTime:0,duration:0,playbackRate:1,loopMode:`off`,isShuffle:!1,seekStep:10,sleepTimer:null,sleepTimerInterval:null,settings:{}},this.listeners=new Set}get(){return this.state}set(e){this.state={...this.state,...e},this.notify()}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}notify(){for(let e of this.listeners)try{e(this.state)}catch(e){console.error(`State listener error:`,e)}}setJobs(e){let t=e.filter(e=>e.status===`queued`||e.status===`downloading`||e.status===`processing`||e.deviceSaving).length;this.set({jobs:e,activeJobsCount:t})}updateJob(e){let t=this.state.jobs.findIndex(t=>t.id===e.id),n=[...this.state.jobs];t>=0?n[t]=e:n.unshift(e),this.setJobs(n)}},t=null;function n(e){t=e}async function r(e,n={}){n.credentials=`include`,n.headers||={};let r=localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`);r&&!n.headers.Authorization&&(n.headers.Authorization=`Bearer ${r}`),n.body&&!(n.body instanceof FormData)&&typeof n.body==`object`&&(n.headers[`Content-Type`]=`application/json`,n.body=JSON.stringify(n.body));let i=await fetch(e,n);if(i.status===401){t&&t();let e=await i.json().catch(()=>({error:`Unauthorized`}));throw Error(e.error||`Vui lòng đăng nhập`)}if(!i.ok){let e=await i.json().catch(()=>({error:i.statusText}));throw Error(e.error||e.message||`Request failed with status ${i.status}`)}return i.json().catch(()=>({}))}var i={auth:{check:()=>r(`/api/auth/me`),login:(e,t)=>r(`/api/auth/login`,{method:`POST`,body:{password:e,profileId:t}}),logout:async()=>{try{await r(`/api/auth/logout`,{method:`POST`})}finally{localStorage.removeItem(`muzifi_token`),localStorage.removeItem(`metube_token`)}},googleUrl:()=>r(`/api/auth/google/url`)},tracks:{list:(e={})=>r(`/api/tracks?${new URLSearchParams(e).toString()}`),update:(e,t)=>r(`/api/tracks/${e}`,{method:`PATCH`,body:t}),delete:e=>r(`/api/tracks/${e}`,{method:`DELETE`}),batchDelete:e=>r(`/api/tracks/batch-delete`,{method:`POST`,body:{ids:e}}),upload:(e,n)=>new Promise((r,i)=>{let a=new XMLHttpRequest;a.open(`POST`,`/api/tracks/upload`),a.withCredentials=!0,a.upload&&n&&(a.upload.onprogress=e=>{e.lengthComputable&&n(Math.round(e.loaded/e.total*100),e.loaded,e.total)}),a.onload=()=>{if(a.status>=200&&a.status<300)try{r(JSON.parse(a.responseText))}catch{r({})}else if(a.status===401)t&&t(),i(Error(`Unauthorized`));else{let e=`Upload failed`;try{e=JSON.parse(a.responseText).error||e}catch{}i(Error(e))}},a.onerror=()=>i(Error(`Network error during upload`)),a.send(e)})},get:e=>r(e),soundcloud:{info:e=>r(`/api/soundcloud/info`,{method:`POST`,body:{url:e}}),download:e=>r(`/api/soundcloud/download`,{method:`POST`,body:e}),getFeed:(e=``,t={})=>{let n=new URLSearchParams(t);e&&n.set(`topic`,e);let i=n.toString();return r(`/api/soundcloud/feed`+(i?`?`+i:``))},search:(e,t={})=>{let n=new URLSearchParams(t);return n.set(`q`,e),r(`/api/soundcloud/search?`+n.toString())},suggest:e=>r(`/api/soundcloud/suggest?q=`+encodeURIComponent(e)),getRelated:e=>r(`/api/soundcloud/related?v=`+encodeURIComponent(e)),preload:(e={})=>r(`/api/soundcloud/preload?`+new URLSearchParams(e).toString()),getQualities:e=>r(`/api/soundcloud/qualities?v=`+encodeURIComponent(e)),meData:()=>r(`/api/soundcloud/me-data`),syncMeData:()=>r(`/api/soundcloud/me-data/sync`,{method:`POST`})},youtube:{info:e=>r(`/api/soundcloud/info`,{method:`POST`,body:{url:e}}),download:e=>r(`/api/soundcloud/download`,{method:`POST`,body:e}),getFeed:(e=``,t={})=>{let n=new URLSearchParams(t);e&&n.set(`topic`,e);let i=n.toString();return r(`/api/soundcloud/feed`+(i?`?`+i:``))},search:(e,t={})=>{let n=new URLSearchParams(t);return n.set(`q`,e),r(`/api/soundcloud/search?`+n.toString())},suggest:e=>r(`/api/soundcloud/suggest?q=`+encodeURIComponent(e)),getRelated:e=>r(`/api/soundcloud/related?v=`+encodeURIComponent(e)),preload:(e={})=>r(`/api/soundcloud/preload?`+new URLSearchParams(e).toString()),getQualities:e=>r(`/api/soundcloud/qualities?v=`+encodeURIComponent(e)),meData:()=>r(`/api/soundcloud/me-data`),syncMeData:()=>r(`/api/soundcloud/me-data/sync`,{method:`POST`})},jobs:{list:()=>r(`/api/jobs`),cancel:e=>r(`/api/jobs/${e}/cancel`,{method:`POST`}),retry:e=>r(`/api/jobs/${e}/retry`,{method:`POST`}),clearCompleted:()=>r(`/api/jobs/clear-completed`,{method:`POST`})},playlists:{list:()=>r(`/api/playlists`),create:e=>r(`/api/playlists`,{method:`POST`,body:{name:e}}),get:e=>r(`/api/playlists/${e}`),rename:(e,t)=>r(`/api/playlists/${e}`,{method:`PATCH`,body:{name:t}}),delete:e=>r(`/api/playlists/${e}`,{method:`DELETE`}),addTracks:(e,t)=>r(`/api/playlists/${e}/tracks`,{method:`POST`,body:{trackIds:t}}),removeTrack:(e,t)=>r(`/api/playlists/${e}/tracks/${t}`,{method:`DELETE`}),reorder:(e,t)=>r(`/api/playlists/${e}/reorder`,{method:`PUT`,body:{trackIds:t}}),uploadAvatar:(e,t)=>r(`/api/playlists/${e}/avatar`,{method:`POST`,body:t}),setAvatar:(e,t)=>r(`/api/playlists/${e}`,{method:`PATCH`,body:{avatar:t}})},player:{getState:()=>r(`/api/player-state`),updateState:e=>r(`/api/player-state`,{method:`PUT`,body:e})},lyrics:{get:(e={})=>r(`/api/lyrics?`+new URLSearchParams(e).toString())},system:{storage:()=>r(`/api/system/storage`),settings:()=>r(`/api/settings`),updateSettings:e=>r(`/api/settings`,{method:`PUT`,body:e}),updateYtDlp:()=>r(`/api/system/update-ytdlp`,{method:`POST`})}},a=(e,{w:t=18,h:n=18,fill:r=`none`,stroke:i=`currentColor`,sw:a=2}={})=>`<svg viewBox="0 0 24 24" width="${t}" height="${n}" fill="${r}" stroke="${i}" stroke-width="${a}" stroke-linecap="round" stroke-linejoin="round">${e}</svg>`,o={play:a(`<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>`,{fill:`currentColor`,stroke:`none`}),pause:a(`<rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/>`,{fill:`currentColor`,stroke:`none`}),next:a(`<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>`),prev:a(`<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>`),shuffle:a(`<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>`),repeat:a(`<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`),music:a(`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`),audioFile:a(`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`),videoFile:a(`<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`),video:a(`<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`),film:a(`<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>`),search:a(`<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`),plus:a(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`),x:a(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,{w:20,h:20}),check:a(`<polyline points="20 6 9 17 4 12"/>`),more:a(`<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>`,{w:20,h:20}),edit:a(`<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`),trash:a(`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`),download:a(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`),refresh:a(`<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`),queue:a(`<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`),chevronDown:a(`<polyline points="6 9 12 15 18 9"/>`,{w:20,h:20}),globe:a(`<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`),radio:a(`<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>`),wifi:a(`<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`),key:a(`<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>`),clock:a(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`),alertCircle:a(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`),checkCircle:a(`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`),xCircle:a(`<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`),info:a(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`),lightbulb:a(`<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>`),zap:a(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>`,{fill:`currentColor`,stroke:`none`,w:14,h:14}),settings:a(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`),volumeHigh:a(`<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`),pip:a(`<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="10" width="8" height="6" rx="1" fill="currentColor"/>`),maximize:a(`<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`),mic:a(`<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`),heart:a(`<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`),heartFilled:a(`<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>`,{fill:`currentColor`}),externalLink:a(`<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,{w:14,h:14}),alertTriangle:a(`<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`),sparkles:a(`<path d="M12 3l1.91 5.89L19.8 10.8l-5.89 1.91L12 18.6l-1.91-5.89L4.2 10.8l5.89-1.91L12 3z"/>`)};function s(e,t={}){try{let n=document.getElementById(`btn-header-jobs`)||document.querySelector(`.header-right`),r={top:14,left:window.innerWidth-60,width:38,height:38};if(n){let e=n.getBoundingClientRect();e.width>0&&e.height>0&&(r=e)}let i=window.innerWidth/2,a=window.innerHeight/2;if(e){if(e.target&&e.clientX!==void 0)i=e.clientX,a=e.clientY;else if(typeof e.getBoundingClientRect==`function`){let t=e.getBoundingClientRect();i=t.left+t.width/2,a=t.top+t.height/2}else typeof e.left==`number`&&(i=e.left+(e.width||0)/2,a=e.top+(e.height||0)/2)}let o=r.left+r.width/2,s=r.top+r.height/2,c=document.createElement(`div`);c.className=`fly-to-download-ghost`;let l=t.thumbnail_url||t.thumbnail||(t.youtubeId?`https://i.ytimg.com/vi/${t.youtubeId}/default.jpg`:``);c.innerHTML=l?`<img src="${l}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;pointer-events:none;">`:`
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#fff;">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      `,c.style.cssText=`
      position: fixed;
      top: ${a-26}px;
      left: ${i-26}px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      z-index: 100000;
      pointer-events: none;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-surface, #1e1e24);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6), 0 0 16px rgba(99, 102, 241, 0.8);
      border: 2px solid var(--accent-primary, #6366f1);
      transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
      transition: transform 0.68s cubic-bezier(0.2, 0.9, 0.3, 1),
                  top 0.68s cubic-bezier(0.5, 0, 0.8, 0.3),
                  left 0.68s cubic-bezier(0.2, 0.9, 0.3, 1),
                  opacity 0.68s cubic-bezier(0.4, 0, 1, 1);
      opacity: 1;
    `,document.body.appendChild(c),requestAnimationFrame(()=>{requestAnimationFrame(()=>{c.style.top=`${s-13}px`,c.style.left=`${o-13}px`,c.style.width=`26px`,c.style.height=`26px`,c.style.transform=`translate3d(0, 0, 0) scale(0.6) rotate(360deg)`,c.style.opacity=`0.3`})}),setTimeout(()=>{c.remove(),n&&(n.classList.remove(`jobs-btn-pop`),n.offsetWidth,n.classList.add(`jobs-btn-pop`),setTimeout(()=>n.classList.remove(`jobs-btn-pop`),600))},700)}catch(e){console.warn(`animateFlyToCorner notice:`,e)}}var c=`muzifi_offline_v2`,l=1,u=`tracks_blob`,d=null;function f(){return d?Promise.resolve(d):new Promise((e,t)=>{if(!(`indexedDB`in window))return t(Error(`IndexedDB không được hỗ trợ trên trình duyệt này`));let n=indexedDB.open(c,l);n.onupgradeneeded=e=>{let t=e.target.result;t.objectStoreNames.contains(u)||t.createObjectStore(u,{keyPath:`id`})},n.onsuccess=t=>{d=t.target.result,d.onclose=()=>{d=null},e(d)},n.onerror=e=>{t(n.error||Error(`Không thể mở IndexedDB`))}})}async function p(e){if(!e)return!1;try{let t=await f();return new Promise(n=>{let r=t.transaction(u,`readonly`).objectStore(u).getKey(e);r.onsuccess=()=>n(!!r.result),r.onerror=()=>n(!1)})}catch{return!1}}async function m(e){if(!e)return null;try{let t=await f();return new Promise((n,r)=>{let i=t.transaction(u,`readonly`).objectStore(u).get(e);i.onsuccess=()=>n(i.result||null),i.onerror=()=>r(i.error)})}catch(e){return console.warn(`[OfflineStorage] getTrackOffline error:`,e),null}}async function h(){try{let e=await f();return new Promise(t=>{let n=e.transaction(u,`readonly`).objectStore(u).getAllKeys();n.onsuccess=()=>t(new Set(n.result||[])),n.onerror=()=>t(new Set)})}catch{return new Set}}var g=new Map;async function _(e,t=``,n=null){if(!e||!e.id)return!1;let r=e.id;if(g.has(r))return g.get(r);let i=v(e,t,n).finally(()=>{g.delete(r)});return g.set(r,i),i}async function v(e,t=``,n=null){if(!e||!e.id)return!1;let r=t||localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`)||``,i=`/api/tracks/${e.id}/stream`,a=r?`${i}?token=${encodeURIComponent(r)}`:i,o=`/api/tracks/${e.id}/thumb`,s=r?`${o}?token=${encodeURIComponent(r)}`:o,c=`/api/lyrics?trackId=${encodeURIComponent(e.id)}`,l=r?`${c}&token=${encodeURIComponent(r)}`:c;try{let t=fetch(s,{credentials:`include`}).then(e=>e.ok?e.blob():null).catch(()=>null),r=fetch(l,{credentials:`include`}).then(e=>e.ok?e.json():null).catch(()=>null),i=await fetch(a,{credentials:`include`});if(!i.ok)throw Error(`Tải audio thất bại (HTTP ${i.status})`);let o=parseInt(i.headers.get(`content-length`)||`0`,10),c=e.mime||(e.media_type===`video`?`video/mp4`:`audio/mp4`),d=null,p=0,m=-1,h=(e,t,r,i=!1)=>{if(!n)return;let a=Date.now();if(!i&&a-p<180&&e<m+3)return;p=a,m=e;let o=(t/1048576).toFixed(1),s=r>0?(r/1048576).toFixed(1):o;try{n({receivedBytes:t,contentLength:r,percent:e,loadedMb:o,totalMb:s})}catch{}};if(o>0&&i.body&&typeof i.body.getReader==`function`){let e=i.body.getReader(),t=[],n=0;for(;;){let{done:r,value:i}=await e.read();if(r)break;t.push(i),n+=i.length,h(Math.min(99,Math.round(n/o*100)),n,o)}h(100,n,o,!0),d=new Blob(t,{type:c})}else{let e=await i.blob();if(!e||e.size===0)throw Error(`Dữ liệu audio nhận được rỗng`);d=e.type?e:new Blob([e],{type:c}),h(100,d.size,d.size,!0)}let[g,_]=await Promise.all([t,r]),v={id:e.id,title:e.title,artist:e.artist,duration_sec:e.duration_sec,media_type:e.media_type,mime:d.type||c,blob:d,size:d.size,thumbBlob:g,lyrics:_,savedAt:Date.now()},y=await f();return await new Promise((e,t)=>{let n=y.transaction(u,`readwrite`).objectStore(u).put(v);n.onsuccess=()=>e(!0),n.onerror=()=>t(n.error)}),!0}catch(t){throw console.warn(`[OfflineStorage] Failed to save track ${e.id}:`,t),t}}var y=class{constructor(){if(this.audio=document.getElementById(`core-audio`),this.video=document.getElementById(`core-video`),this.activeMedia=this.audio,this.isDraggingScrubber=!1,this.lastSavedPosition=0,this.saveInterval=null,this.toastTimer=null,this.lastTapTime=0,this.isLyricsOpen=!1,this.currentLyrics=null,this.currentLyricIndex=-1,this.lyricsLoadingTrackId=null,this.isFetchingSimilar=!1,this.preloadedTrackId=null,this.preloadedBlobUrl=null,this.preloadedLyrics=null,this.currentBlobUrl=null,this.currentVideoQuality=parseInt(localStorage.getItem(`muzifi_video_quality`)||localStorage.getItem(`metube_video_quality`)||`0`,10)||0,this.availableQualities=[],this.qualitiesFetched=!1,this.lastPositionSyncTime=0,`audioSession`in navigator)try{navigator.audioSession.type=`playback`}catch{}this.initElements(),this.initMediaEvents(),this.initMediaSession(),this.initControls(),this.initKeyboardShortcuts(),this.startStateSyncTimer()}initElements(){this.miniPlayer=document.getElementById(`mini-player`),this.miniProgressBar=document.querySelector(`.mini-progress-bar`),this.miniProgressFill=document.getElementById(`mini-progress-fill`),this.miniClickArea=document.getElementById(`mini-click-area`),this.miniThumb=document.getElementById(`mini-thumb`),this.miniTitle=document.getElementById(`mini-title`),this.miniArtist=document.getElementById(`mini-artist`),this.miniQueueBtn=document.getElementById(`mini-btn-queue`),this.miniPrevBtn=document.getElementById(`mini-btn-prev`),this.miniPlayBtn=document.getElementById(`mini-btn-play`),this.miniPlayIcon=document.getElementById(`mini-play-icon`),this.miniNextBtn=document.getElementById(`mini-btn-next`),this.fullPlayer=document.getElementById(`full-player`),this.playerDownloadBtn=document.getElementById(`btn-player-download`),this.playerTitle=document.getElementById(`player-title`),this.playerArtist=document.getElementById(`player-artist`),this.playerArtwork=document.getElementById(`player-artwork`),this.playerTypeBadge=document.getElementById(`player-type-badge`),this.audioView=document.getElementById(`player-audio-view`),this.videoView=document.getElementById(`player-video-view`),this.mainPlayBtn=document.getElementById(`btn-play-pause`),this.mainPlayIcon=document.getElementById(`main-play-icon`),this.prevBtn=document.getElementById(`btn-prev`),this.nextBtn=document.getElementById(`btn-next`),this.shuffleBtn=document.getElementById(`btn-shuffle`),this.loopBtn=document.getElementById(`btn-loop`),this.loopSub=document.getElementById(`loop-subscript`),this.rateBtn=document.getElementById(`btn-playback-rate`),this.sleepBtn=document.getElementById(`btn-sleep-timer`),this.sleepText=document.getElementById(`sleep-timer-text`),this.closeBtn=document.getElementById(`player-btn-close`),this.dragHandle=document.getElementById(`player-drag-handle`),this.tabUpNextBtn=document.getElementById(`tab-btn-upnext`),this.tabLyricsBtn=document.getElementById(`tab-btn-lyrics`),this.upNextView=document.getElementById(`player-upnext-view`),this.upNextCloseBtn=document.getElementById(`btn-upnext-close`),this.upNextDragHandle=document.getElementById(`upnext-drag-handle`),this.upNextContentWrapper=document.getElementById(`upnext-content-wrapper`),this.upNextSubtitle=document.getElementById(`upnext-header-subtitle`),this.lyricsView=document.getElementById(`player-lyrics-view`),this.lyricsCloseBtn=document.getElementById(`btn-lyrics-close`),this.lyricsScrollContainer=document.getElementById(`lyrics-scroll-container`),this.lyricsLoading=document.getElementById(`lyrics-loading`),this.lyricsEmpty=document.getElementById(`lyrics-empty`),this.lyricsLinesWrapper=document.getElementById(`lyrics-lines-wrapper`),this.lyricsTrackTitle=document.getElementById(`lyrics-track-title`),this.pipBtn=document.getElementById(`btn-pip`),this.fullscreenBtn=document.getElementById(`btn-fullscreen`),this.qualityBtn=document.getElementById(`btn-video-quality`),this.qualityLabel=document.getElementById(`video-quality-label`),this.loadingOverlay=document.getElementById(`player-loading-overlay`),this.scrubberTrack=document.getElementById(`scrubber-track`),this.scrubberFill=document.getElementById(`scrubber-fill`),this.scrubberHandle=document.getElementById(`scrubber-handle`),this.currentTimeEl=document.getElementById(`player-time-current`),this.totalTimeEl=document.getElementById(`player-time-total`)}showPlayerLoading(e=`Đang tải...`){if(this.loadingOverlay){let t=this.loadingOverlay.querySelector(`.player-loading-text`);t&&(t.textContent=e),this.loadingOverlay.style.display=`flex`}}hidePlayerLoading(){this.loadingOverlay&&(this.loadingOverlay.style.display=`none`)}initMediaEvents(){let t=t=>{t.addEventListener(`timeupdate`,()=>this.onTimeUpdate()),t.addEventListener(`ended`,()=>this.onEnded()),t.addEventListener(`play`,()=>{this.onPlayStateChange(!0),this.bindMediaSessionActions()}),t.addEventListener(`playing`,()=>{this.hidePlayerLoading(),this.syncPositionState(),this.bindMediaSessionActions()}),t.addEventListener(`canplay`,()=>{this.hidePlayerLoading()}),t.addEventListener(`waiting`,()=>{let{currentTrack:t}=e.get();t?.isOnline&&this.showPlayerLoading(`Đang tải luồng...`)}),t.addEventListener(`pause`,()=>{this.hidePlayerLoading(),this.onPlayStateChange(!1),this.syncPositionState()}),t.addEventListener(`loadedmetadata`,()=>this.onLoadedMetadata()),t.addEventListener(`error`,e=>{this.hidePlayerLoading(),this.onError(e)})};t(this.audio),this.video&&t(this.video),this.audio&&`preservesPitch`in this.audio&&(this.audio.preservesPitch=!0),this.video&&`preservesPitch`in this.video&&(this.video.preservesPitch=!0)}initMediaSession(){this.bindMediaSessionActions()}bindMediaSessionActions(){if(!(`mediaSession`in navigator))return;let e=navigator.mediaSession,t=(t,n)=>{try{e.setActionHandler(t,n)}catch{}};t(`play`,()=>this.play()),t(`pause`,()=>this.pause()),t(`previoustrack`,()=>this.prev()),t(`nexttrack`,()=>this.next()),t(`stop`,()=>this.pause()),t(`seekto`,e=>{e&&e.seekTime!==void 0&&!isNaN(e.seekTime)&&this.seek(e.seekTime)}),t(`seekbackward`,null),t(`seekforward`,null)}initControls(){this.miniClickArea&&this.miniClickArea.addEventListener(`click`,()=>this.openFullPlayer()),this.closeBtn&&this.closeBtn.addEventListener(`click`,()=>this.closeFullPlayer()),this.dragHandle&&this.dragHandle.addEventListener(`click`,()=>this.closeFullPlayer()),this.miniQueueBtn&&this.miniQueueBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.showUpNextModal()}),this.miniPrevBtn&&this.miniPrevBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.prev()}),this.miniPlayBtn&&this.miniPlayBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.togglePlay()}),this.miniNextBtn&&this.miniNextBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.next()}),this.playerDownloadBtn&&this.playerDownloadBtn.addEventListener(`click`,t=>{t.stopPropagation(),this.downloadTrackAudio(e.get().currentTrack,this.playerDownloadBtn)}),this.miniProgressBar&&this.miniProgressBar.addEventListener(`click`,e=>{e.stopPropagation();let t=this.miniProgressBar.getBoundingClientRect(),n=Math.max(0,Math.min(1,(e.clientX-t.left)/t.width)),r=this.getDuration();r>0&&this.seek(n*r)}),this.mainPlayBtn&&this.mainPlayBtn.addEventListener(`click`,()=>this.togglePlay()),this.prevBtn&&this.prevBtn.addEventListener(`click`,()=>this.prev()),this.nextBtn&&this.nextBtn.addEventListener(`click`,()=>this.next()),this.videoView&&this.videoView.addEventListener(`click`,e=>{if(e.target.closest(`#video-overlay-ctrls`))return;let t=Date.now();if(t-this.lastTapTime<300){let t=this.videoView.getBoundingClientRect();e.clientX-t.left<t.width/2?this.seekBy(-10):this.seekBy(10),this.lastTapTime=0}else this.lastTapTime=t,setTimeout(()=>{this.lastTapTime===t&&this.togglePlay()},250)}),this.shuffleBtn&&this.shuffleBtn.addEventListener(`click`,()=>this.toggleShuffle()),this.loopBtn&&this.loopBtn.addEventListener(`click`,()=>this.cycleLoopMode()),this.rateBtn&&this.rateBtn.addEventListener(`click`,()=>this.showSpeedModal()),this.sleepBtn&&this.sleepBtn.addEventListener(`click`,()=>this.showSleepTimerModal()),this.tabUpNextBtn&&this.tabUpNextBtn.addEventListener(`click`,()=>this.toggleUpNext()),this.tabLyricsBtn&&this.tabLyricsBtn.addEventListener(`click`,()=>this.toggleLyrics()),this.upNextCloseBtn&&this.upNextCloseBtn.addEventListener(`click`,()=>this.closeUpNext()),this.upNextDragHandle&&this.upNextDragHandle.addEventListener(`click`,()=>this.closeUpNext()),this.lyricsCloseBtn&&this.lyricsCloseBtn.addEventListener(`click`,()=>this.closeLyrics());let t=e=>{let t=this.scrubberTrack.getBoundingClientRect(),n=e.touches?e.touches[0].clientX:e.clientX,r=Math.max(0,Math.min(1,(n-t.left)/t.width)),i=r*this.getDuration();return this.scrubberFill.style.width=`${r*100}%`,this.scrubberHandle.style.left=`${r*100}%`,this.currentTimeEl.textContent=this.formatTime(i),this.isDraggingScrubber||this.seek(i),i};this.scrubberTrack&&(this.scrubberTrack.addEventListener(`mousedown`,e=>{this.isDraggingScrubber=!0,t(e);let n=e=>t(e),r=e=>{this.isDraggingScrubber=!1;let i=t(e);this.seek(i),window.removeEventListener(`mousemove`,n),window.removeEventListener(`mouseup`,r)};window.addEventListener(`mousemove`,n),window.addEventListener(`mouseup`,r)}),this.scrubberTrack.addEventListener(`touchstart`,e=>{this.isDraggingScrubber=!0,t(e);let n=e=>t(e),r=e=>{this.isDraggingScrubber=!1;let i=t(e.changedTouches?e.changedTouches[0]:e);this.seek(i),window.removeEventListener(`touchmove`,n),window.removeEventListener(`touchend`,r)};window.addEventListener(`touchmove`,n,{passive:!1}),window.addEventListener(`touchend`,r)},{passive:!0})),this.pipBtn&&this.pipBtn.addEventListener(`click`,async e=>{e.stopPropagation();try{document.pictureInPictureElement?await document.exitPictureInPicture():document.pictureInPictureEnabled&&await this.video.requestPictureInPicture()}catch(e){console.warn(`PiP error:`,e)}}),this.fullscreenBtn&&this.fullscreenBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.video.requestFullscreen?this.video.requestFullscreen():this.video.webkitEnterFullscreen&&this.video.webkitEnterFullscreen()}),this.qualityBtn&&this.qualityBtn.addEventListener(`click`,e=>{e.stopPropagation(),this.showQualityModal()})}initKeyboardShortcuts(){window.addEventListener(`keydown`,e=>{[`INPUT`,`TEXTAREA`,`SELECT`].includes(document.activeElement?.tagName)||(e.code===`Space`?(e.preventDefault(),this.togglePlay()):e.code===`ArrowLeft`?(e.preventDefault(),this.prev()):e.code===`ArrowRight`?(e.preventDefault(),this.next()):e.key===`[`||e.code===`Minus`?(e.preventDefault(),this.stepPlaybackRate(-.25)):e.key===`]`||e.code===`Equal`?(e.preventDefault(),this.stepPlaybackRate(.25)):e.key===`l`||e.key===`L`?(e.preventDefault(),this.cycleLoopMode()):(e.key===`s`||e.key===`S`)&&(e.preventDefault(),this.toggleShuffle()))})}getDuration(){let t=this.activeMedia.duration;if(t&&!isNaN(t)&&t>0)return t;let n=e.get().currentTrack?.duration_sec;return n&&!isNaN(n)&&n>0?n:0}getAuthStreamUrl(e){if(!e)return e;let t=localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`);return t?`${e}${e.includes(`?`)?`&`:`?`}token=${encodeURIComponent(t)}`:e}async loadTrack(t,n=!0,r=0,i=!1){if(!t)return;this.preloadedTrackId=null,this.hidePlayerLoading(),i&&this.openFullPlayer();let a=`/api/tracks/${t.id}/thumb`;this.miniThumb&&(this.miniThumb.src=a),this.miniTitle&&(this.miniTitle.textContent=t.title),this.miniArtist&&(this.miniArtist.textContent=t.artist||`Nghệ sĩ`),this.miniPlayer&&(this.miniPlayer.style.display=`flex`),this.playerTitle&&(this.playerTitle.textContent=t.title),this.playerArtist&&(this.playerArtist.textContent=t.artist||`Nghệ sĩ`),this.playerArtwork&&(this.playerArtwork.src=a),this.playerTypeBadge&&(this.playerTypeBadge.style.display=`none`),this.playerDownloadBtn&&(this.playerDownloadBtn.style.display=`none`),e.set({currentTrack:t,currentTime:r,duration:t.duration_sec||0,isPlaying:n}),this.updateMediaSession(t),this.updateDocumentTitle(),this.video&&this.video.pause(),this.activeMedia=this.audio,this.videoView&&(this.videoView.style.display=`none`),this.audioView&&(this.audioView.style.display=`block`);let o=e.get().playbackRate||1;this.activeMedia.playbackRate=o,this.rateBtn&&(this.rateBtn.textContent=`${o}x`),this.activeMedia.loop=!1;let s=this.getAuthStreamUrl(`/api/tracks/${t.id}/stream`),c=!1;if(this.preloadedTrackId===t.id&&this.preloadedBlobUrl){if(this.currentBlobUrl&&this.currentBlobUrl!==this.preloadedBlobUrl)try{URL.revokeObjectURL(this.currentBlobUrl)}catch{}this.currentBlobUrl=this.preloadedBlobUrl,s=this.currentBlobUrl,c=!0,this.preloadedLyrics&&!this.currentLyrics&&(this.currentLyrics=this.preloadedLyrics),this.preloadedBlobUrl=null,this.preloadedTrackId=null,this.preloadedLyrics=null}if(this.audio.src=s,this.audio.load(),r>0&&(this.activeMedia.currentTime=r),n){let t=this.activeMedia.play();t!==void 0&&t.catch(t=>{console.warn(`Continuous playback start notice:`,t),setTimeout(()=>{this.activeMedia.paused&&e.get().isPlaying&&this.activeMedia.play().catch(()=>{this.onPlayStateChange(!1)})},150)})}c||m(t.id).then(e=>{e&&e.blob&&e.blob.size>0?e.lyrics&&!this.currentLyrics&&(this.currentLyrics=e.lyrics,this.isLyricsOpen&&this.renderLyrics(this.currentLyrics)):navigator.onLine&&_(t).catch(()=>{})}).catch(e=>console.warn(`IndexedDB track check notice:`,e)),this.currentLyrics=null,this.currentLyricIndex=-1,this.isLyricsOpen&&this.loadLyricsForCurrentTrack(),this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent(),this.notifySWCacheTrack(t.id),this.preloadNextInQueue()}async loadOnlineTrack(t,n=!1){if(!t)return;if(!navigator.onLine){this.showToast(`Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.`,3500);return}this.preloadedTrackId=null,n&&this.openFullPlayer(),(this.isFullPlayerOpen()||n)&&this.showPlayerLoading(`Đang tải...`);let r=t.soundcloudId||t.youtubeId||t.id,i=this.getAuthStreamUrl(`/api/soundcloud/stream?v=${encodeURIComponent(r)}&type=audio`);this.video&&this.video.pause(),this.activeMedia=this.audio,this.videoView&&(this.videoView.style.display=`none`),this.audioView&&(this.audioView.style.display=`block`),this.audio.src=i,this.audio.load();let a=e.get().playbackRate||1;this.activeMedia.playbackRate=a,this.rateBtn&&(this.rateBtn.textContent=`${a}x`),this.activeMedia.loop=!1;let o=t.thumbnail_url||`/api/tracks/placeholder/thumb`;this.miniThumb&&(this.miniThumb.src=o),this.miniTitle&&(this.miniTitle.textContent=t.title),this.miniArtist&&(this.miniArtist.textContent=t.artist||`Nghệ sĩ`),this.miniPlayer&&(this.miniPlayer.style.display=`flex`),this.playerTitle&&(this.playerTitle.textContent=t.title),this.playerArtist&&(this.playerArtist.textContent=t.artist||`Nghệ sĩ`),this.playerArtwork&&(this.playerArtwork.src=o),this.playerTypeBadge&&(this.playerTypeBadge.style.display=`none`),this.playerDownloadBtn&&(this.playerDownloadBtn.style.display=`inline-flex`),e.set({currentTrack:t,currentTime:0,duration:t.duration_sec||0,isLibraryQueue:!1}),this.updateDocumentTitle(),this.currentLyrics=null,this.currentLyricIndex=-1,this.isLyricsOpen&&this.loadLyricsForCurrentTrack(),this.updateMediaSession(t);let s=this.activeMedia.play();s!==void 0&&s.catch(t=>{console.warn(`Online autoplay notice:`,t),setTimeout(()=>{this.activeMedia.paused&&e.get().isPlaying&&this.activeMedia.play().catch(()=>{this.onPlayStateChange(!1)})},150)}),this.preloadNextInQueue()}updateMediaSession(e){if(!(`mediaSession`in navigator)||!e)return;let t=e.thumbnail_url;t?t.startsWith(`/`)&&(t=`${window.location.origin}${t}`):t=`${window.location.origin}/api/tracks/${e.id}/thumb`;let n=e.artist&&e.artist!==`Nghệ sĩ`?e.artist:e.channel||`Muzifi`,r=e.album||(e.isOnline?`Trực tuyến`:`Muzifi`);try{navigator.mediaSession.metadata=new MediaMetadata({title:e.title||`Đang phát`,artist:n,album:r,artwork:[{src:t,sizes:`96x96`,type:`image/jpeg`},{src:t,sizes:`128x128`,type:`image/jpeg`},{src:t,sizes:`192x192`,type:`image/jpeg`},{src:t,sizes:`256x256`,type:`image/jpeg`},{src:t,sizes:`512x512`,type:`image/jpeg`}]})}catch(e){console.warn(`Failed to set mediaSession metadata:`,e)}}updateDocumentTitle(){let{currentTrack:t,isPlaying:n}=e.get();if(!t||!t.title){document.title=`Muzifi - Nghe Nhạc Offline & Tải Nhạc Miễn Phí`;return}let r=t.artist&&t.artist!==`Nghệ sĩ`?` - ${t.artist}`:``;document.title=`${t.title}${r} | Muzifi`}async play(){try{await this.activeMedia.play()}catch(e){console.warn(`Play failed:`,e)}}pause(){this.activeMedia.pause()}togglePlay(){this.activeMedia.paused?this.play():this.pause()}seek(e){let t=this.getDuration(),n=Math.max(0,Math.min(e,t>0?t:86400));this.activeMedia.currentTime=n,this.onTimeUpdate(),this.syncPositionState()}seekBy(e){let t=this.activeMedia.currentTime||0;this.seek(t+e);let n=e>0?`+${e}`:`${e}`;this.showToast(`Tua ${n}s`,1e3)}stepPlaybackRate(t){let n=e.get().playbackRate||1,r=Math.round((n+t)*100)/100;this.setPlaybackRate(r)}setPlaybackRate(t){let n=parseFloat(Math.max(.25,Math.min(t,3)).toFixed(2));this.audio.playbackRate=n,this.video.playbackRate=n,e.set({playbackRate:n}),this.rateBtn&&(this.rateBtn.textContent=`${n}x`),this.syncPositionState(),this.showToast(`Tốc độ phát: ${n}x`,1200)}showSpeedModal(){let t=document.getElementById(`modal-container`),n=e.get().playbackRate||1;t.innerHTML=`
      <div class="modal-overlay" id="speed-picker-modal">
        <div class="modal-card" style="max-width:340px;">
          <div class="modal-header">
            <h3 class="modal-title">Tốc độ phát</h3>
            <button class="icon-btn" id="modal-speed-close">${o.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
            ${[.5,.75,1,1.25,1.5,1.75,2].map(e=>`
              <button class="btn-secondary speed-option-btn ${e===n?`active`:``}" data-rate="${e}" style="justify-content:space-between;padding:10px 16px;">
                <span>${e===1?`1.0x (Chuẩn)`:`${e}x`}</span>
                ${e===n?`<span style="color:var(--accent-primary);display:inline-flex;align-items:center;">${o.check}</span>`:``}
              </button>
            `).join(``)}
          </div>
        </div>
      </div>
    `;let r=document.getElementById(`speed-picker-modal`);r.querySelector(`#modal-speed-close`).addEventListener(`click`,()=>r.remove()),r.addEventListener(`click`,e=>{e.target===r&&r.remove()}),r.querySelectorAll(`.speed-option-btn`).forEach(e=>{e.addEventListener(`click`,()=>{let t=parseFloat(e.dataset.rate);this.setPlaybackRate(t),r.remove()})})}async showQualityModal(){let{currentTrack:t}=e.get();if(!t||!t.youtubeId){this.showToast(`Chỉ áp dụng cho video trực tuyến`,1500);return}let n=document.getElementById(`modal-container`);n.innerHTML=`
      <div class="quality-modal-backdrop" id="quality-modal">
        <div class="quality-modal">
          <div class="quality-modal-header">
            <h3>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Chất lượng video
            </h3>
            <button class="quality-modal-close" id="quality-modal-close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="quality-loading" id="quality-loading">
            <div class="spinner"></div>
            <span>Đang tải chất lượng có sẵn...</span>
          </div>
        </div>
      </div>
    `;let r=document.getElementById(`quality-modal`);r.querySelector(`#quality-modal-close`).addEventListener(`click`,()=>r.remove()),r.addEventListener(`click`,e=>{e.target===r&&r.remove()});try{let e=(await(i.youtube.getQualities?i.youtube.getQualities(t.youtubeId):i.get(`/api/youtube/qualities?v=${encodeURIComponent(t.youtubeId)}`)).catch(()=>({})))?.qualities||[];(!Array.isArray(e)||e.length===0)&&(e=[{height:1080,label:`1080p HD`},{height:720,label:`720p HD`},{height:480,label:`480p`},{height:360,label:`360p`}]);let n=[{height:0,label:`Tự động`},...e],a=this.currentVideoQuality,o=document.getElementById(`quality-loading`);o&&(o.outerHTML=`
          <div class="quality-modal-list">
            ${n.map(e=>{let t=e.height===a;e.height;let n=e.height===0?``:e.height>=1080?`<span class="quality-item-tag hd">FHD</span>`:e.height>=720?`<span class="quality-item-tag hd">HD</span>`:e.height>=480?`<span class="quality-item-tag sd">SD</span>`:``;return`
                <button class="quality-modal-item ${t?`active`:``}" data-quality="${e.height}">
                  <span>
                    <span class="quality-item-label">${e.label}</span>
                    ${n}
                  </span>
                </button>
              `}).join(``)}
          </div>
        `),r.querySelectorAll(`.quality-modal-item`).forEach(e=>{e.addEventListener(`click`,()=>{let t=parseInt(e.dataset.quality,10);this.changeVideoQuality(t),r.remove()})})}catch(e){console.error(`Failed to fetch qualities, applying default list:`,e);let t=[{height:0,label:`Tự động`},{height:1080,label:`1080p HD`},{height:720,label:`720p HD`},{height:480,label:`480p`},{height:360,label:`360p`}],n=document.getElementById(`quality-loading`);n&&(n.outerHTML=`
          <div class="quality-modal-list">
            ${t.map(e=>`
              <button class="quality-modal-item ${e.height===this.currentVideoQuality?`active`:``}" data-quality="${e.height}">
                <span>
                  <span class="quality-item-label">${e.label}</span>
                  ${e.height>=720?`<span class="quality-item-tag hd">HD</span>`:``}
                </span>
              </button>
            `).join(``)}
          </div>
        `,r.querySelectorAll(`.quality-modal-item`).forEach(e=>{e.addEventListener(`click`,()=>{let t=parseInt(e.dataset.quality,10);this.changeVideoQuality(t),r.remove()})}))}}changeVideoQuality(t){let n=this.currentVideoQuality;if(this.currentVideoQuality=t,localStorage.setItem(`muzifi_video_quality`,String(t)),this.qualityLabel&&(this.qualityLabel.textContent=t===0?`Auto`:`${t}p`),n===t)return;let{currentTrack:r}=e.get();if(!r||!r.isOnline||r.media_type!==`video`){this.showToast(t===0?`Chất lượng: Tự động`:`Chất lượng: ${t}p`,1500);return}let i=this.activeMedia.currentTime||0,a=!this.activeMedia.paused,o=t?`&quality=${t}`:``,s=this.getAuthStreamUrl(`/api/youtube/stream?v=${encodeURIComponent(r.youtubeId)}&type=video${o}`);this.showToast(t===0?`Đang chuyển sang chất lượng tự động...`:`Đang chuyển sang ${t}p...`,2e3),this.video.src=s,this.video.currentTime=i;let c=async()=>{if(this.video.removeEventListener(`canplay`,c),this.video.currentTime=i,a)try{await this.video.play()}catch(e){console.warn(`Quality switch autoplay error:`,e)}this.showToast(t===0?`Chất lượng: Tự động`:`Đang phát ${t}p`,1500)};this.video.addEventListener(`canplay`,c)}setLoopMode(t,n=!1){e.set({loopMode:t}),this.audio.loop=!1,this.video&&(this.video.loop=!1),this.loopBtn&&(t===`off`?(this.loopBtn.classList.remove(`active`),this.loopSub&&(this.loopSub.textContent=``),n&&this.showToast(`Tắt lặp lại`,1200)):t===`all`?(this.loopBtn.classList.add(`active`),this.loopSub&&(this.loopSub.textContent=`All`),n&&this.showToast(`Lặp lại danh sách`,1200)):t===`one`&&(this.loopBtn.classList.add(`active`),this.loopSub&&(this.loopSub.textContent=`1`),n&&this.showToast(`Lặp lại 1 bài`,1200)))}cycleLoopMode(){let t=[`off`,`all`,`one`],n=e.get().loopMode||`off`,r=t[(t.indexOf(n)+1)%t.length];this.setLoopMode(r,!0)}toggleShuffle(){let{isShuffle:t,queue:n,originalQueue:r,currentTrack:i}=e.get();if(t){let t=r&&r.length?[...r]:[...n];e.set({isShuffle:!1,queue:t}),this.shuffleBtn&&this.shuffleBtn.classList.remove(`active`),this.showToast(`Đã tắt xáo trộn`,1200),this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent()}else{let t=r&&r.length?[...r]:[...n],a=t.filter(e=>e.id!==i?.id);for(let e=a.length-1;e>0;e--){let t=Math.floor(Math.random()*(e+1));[a[e],a[t]]=[a[t],a[e]]}let o=i?[i,...a]:a;e.set({isShuffle:!0,queue:o,originalQueue:t}),this.shuffleBtn&&this.shuffleBtn.classList.add(`active`),this.showToast(`Đã bật xáo trộn (Shuffle)`,1200),this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent()}this.preloadNextInQueue()}async next(t=!0){let{queue:n,currentTrack:r,loopMode:a,isPlaylistMode:o}=e.get();if(!n||n.length===0)return;let s=n.findIndex(e=>e.id===r?.id||e.youtubeId&&r?.youtubeId&&e.youtubeId===r.youtubeId),c=s===-1?0:s+1;if(c>=n.length){if(a===`all`)c=0;else if(t)c=0;else{let{isLibraryQueue:t}=e.get();if(t||!r?.isOnline||o||r?.isPlaylist){this.pause(),this.seek(0),this.hidePlayerLoading();return}if(navigator.onLine){try{let t=r?.soundcloudId||r?.youtubeId;if(!t&&r?.source_url){let e=r.source_url.match(/(?:tracks\/|v=)([a-zA-Z0-9_-]+)/);e&&(t=e[1])}if(!t&&r?.title&&(t=(await i.soundcloud.search(`${r.title} ${r.artist||``}`.trim(),{limit:1}))?.items?.[0]?.id),t){let a=await i.soundcloud.getRelated(t);if(a?.items&&a.items.length>0){let i=r?.media_type||`audio`,o=a.items.filter(e=>e.id!==t).map(e=>({id:`sc_${e.id}_${i}`,soundcloudId:e.id,youtubeId:e.id,title:e.title,artist:e.channel||e.artist||`Nghệ sĩ`,album:a.topic||a.genre||`SoundCloud Radio`,genre:a.genre||``,duration_sec:e.duration||0,media_type:i,isOnline:!0,thumbnail_url:e.thumbnail,source:`soundcloud`})),s=new Set(n.map(e=>e.soundcloudId||e.youtubeId||e.id&&e.id.replace(/^(sc_|yt_)/,``).split(`_`)[0])),c=o.filter(e=>!s.has(e.soundcloudId)),l=c.length>0?c:o.filter(e=>e.soundcloudId!==t);if(l.length>0){let t=[...n,...l];e.set({queue:t,originalQueue:t});let r=l[0];a.genre&&(r.genre=a.genre,r.topic=a.topic),this.loadOnlineTrack(r);return}}}}catch(e){console.warn(`Failed to autoplay related track:`,e)}this.pause(),this.seek(0),this.hidePlayerLoading();return}this.pause(),this.seek(0),this.hidePlayerLoading();return}}let l=n[c];l&&(l.isOnline?this.loadOnlineTrack(l,!1):this.loadTrack(l,!0,0,!1))}prev(){if(this.activeMedia.currentTime>3){this.seek(0);return}let{queue:t,currentTrack:n}=e.get();if(!t||t.length===0)return;let r=t.findIndex(e=>e.id===n?.id||e.youtubeId&&n?.youtubeId&&e.youtubeId===n.youtubeId)-1;r<0&&(r=t.length-1);let i=t[r];i&&(i.isOnline?this.loadOnlineTrack(i,!1):this.loadTrack(i,!0,0,!1))}onEnded(){let{sleepTimer:t,loopMode:n,currentTrack:r}=e.get();if(t&&t.mode===`end_of_track`){this.pause(),this.clearSleepTimer();return}if(n===`one`){this.seek(0),this.play().catch(()=>{r&&(r.isOnline?this.loadOnlineTrack(r,!1):this.loadTrack(r,!0,0,!1))});return}this.next(!1)}onTimeUpdate(){if(this.isDraggingScrubber)return;let t=this.activeMedia.currentTime||0,n=this.getDuration(),r=n>0?t/n*100:0;this.scrubberFill&&(this.scrubberFill.style.width=`${r}%`),this.scrubberHandle&&(this.scrubberHandle.style.left=`${r}%`),this.miniProgressFill&&(this.miniProgressFill.style.width=`${r}%`),this.currentTimeEl&&(this.currentTimeEl.textContent=this.formatTime(t)),this.totalTimeEl&&(this.totalTimeEl.textContent=this.formatTime(n)),e.set({currentTime:t,duration:n});let i=Date.now();(!this.lastPositionSyncTime||i-this.lastPositionSyncTime>=4e3)&&(this.lastPositionSyncTime=i,this.syncPositionState()),this.updateLyricsHighlight(),this.checkPreloadNextTrack(t,n)}checkPreloadNextTrack(e,t){if(!t||t<=0)return;let n=t-e;n<=30&&n>0&&this.preloadNextInQueue()}preloadNextInQueue(){let{queue:t,currentTrack:n,isPlaylistMode:r,isLibraryQueue:a}=e.get();if(!t||t.length===0)return;let o=t.findIndex(e=>e.id===n?.id||e.youtubeId&&n?.youtubeId&&e.youtubeId===n.youtubeId);if(o===-1)return;!r&&!a&&!n?.isPlaylist&&o+2>=t.length&&n?.isOnline&&!this.isFetchingSimilar&&navigator.onLine&&this.fetchAndQueueSimilarTracks(n);let s=t[o+1];if(!s||this.preloadedTrackId===s.id)return;let c=s.soundcloudId||s.youtubeId;if(s.isOnline&&c&&navigator.onLine){this.preloadedTrackId=s.id;let e=s.media_type||`audio`;i.soundcloud.preload({v:c,type:e}).catch(e=>{console.warn(`[Preload] Server preload notice:`,e)})}else!s.isOnline&&s.id&&m(s.id).then(e=>{if(e&&e.blob&&e.blob.size>0){if(this.preloadedBlobUrl&&this.preloadedBlobUrl!==this.currentBlobUrl)try{URL.revokeObjectURL(this.preloadedBlobUrl)}catch{}this.preloadedTrackId=s.id,this.preloadedBlobUrl=URL.createObjectURL(e.blob),this.preloadedLyrics=e.lyrics}}).catch(()=>{})}onLoadedMetadata(){let t=this.getDuration();this.totalTimeEl&&(this.totalTimeEl.textContent=this.formatTime(t)),e.set({duration:t}),this.syncPositionState()}onPlayStateChange(t){e.set({isPlaying:t}),this.updateDocumentTitle();let n=`<polygon points="5 3 19 12 5 21 5 3"/>`,r=`<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;this.miniPlayIcon&&(this.miniPlayIcon.innerHTML=t?r:n),this.mainPlayIcon&&(this.mainPlayIcon.innerHTML=t?r:n),`mediaSession`in navigator&&(navigator.mediaSession.playbackState=t?`playing`:`paused`)}async onError(t){if(console.error(`Media playback error:`,t),this.hidePlayerLoading(),this.onPlayStateChange(!1),!navigator.onLine){this.showToast(`Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.`,3500);return}let{currentTrack:n,queue:r}=e.get(),i=n?.soundcloudId||n?.youtubeId;if(n?.isOnline&&i)try{let e=this.getAuthStreamUrl(`/api/soundcloud/stream?v=${encodeURIComponent(i)}&type=${n.media_type||`audio`}`),t=await fetch(e);if(!t.ok){let e={};try{e=await t.json()}catch{e={error:await t.text()}}if(t.status===403||e.code===`AGE_RESTRICTED`||e.error&&e.error.includes(`giới hạn độ tuổi`)){this.showToast(`Video này bị giới hạn độ tuổi (18+).`,4e3),this.handlePlaybackSkipAfterError();return}if(t.status===404||e.code===`UNAVAILABLE`||e.error&&e.error.includes(`không khả dụng`)){this.showToast(`Video này không khả dụng hoặc bị chặn bản quyền.`,4e3),this.handlePlaybackSkipAfterError();return}}}catch(e){if(!navigator.onLine||e.message?.includes(`fetch`)||e.message?.includes(`network`)){this.showToast(`Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.`,3500);return}console.warn(`Check stream error failed:`,e)}this.showToast(`Không thể phát nội dung hoặc luồng video. Vui lòng kiểm tra lại.`,3e3)}handlePlaybackSkipAfterError(){let{queue:t,currentTrack:n}=e.get();t&&t.length>1&&setTimeout(()=>{e.get().currentTrack?.id===n?.id&&(this.showToast(`Đang tự động chuyển sang bài tiếp theo...`,2e3),this.next())},2500)}syncPositionState(){if(`mediaSession`in navigator&&navigator.mediaSession.setPositionState)try{let e=this.getDuration();if(e&&!isNaN(e)&&e>0&&isFinite(e)){let t=Math.max(0,Math.min(this.activeMedia.currentTime||0,e));navigator.mediaSession.setPositionState({duration:Math.round(e*100)/100,playbackRate:this.activeMedia.playbackRate||1,position:Math.round(t*100)/100})}}catch{}}clearSleepTimer(){let{sleepTimerInterval:t}=e.get();t&&clearInterval(t),e.set({sleepTimer:null,sleepTimerInterval:null}),this.sleepBtn&&(this.sleepBtn.classList.remove(`active`),this.sleepBtn.title=`Hẹn giờ đi ngủ`),this.sleepText&&(this.sleepText.textContent=``,this.sleepText.style.display=`none`)}setSleepTimer(t){if(this.clearSleepTimer(),!t||t===`off`)return;if(t===`end_of_track`){e.set({sleepTimer:{mode:`end_of_track`,label:`Hết bài`},sleepTimerInterval:null}),this.sleepBtn&&(this.sleepBtn.classList.add(`active`),this.sleepBtn.title=`Hẹn giờ: Hết bài hát này`),this.sleepText&&(this.sleepText.textContent=`Hết bài`,this.sleepText.style.display=`inline-flex`);return}let n=parseInt(t,10);if(isNaN(n)||n<=0)return;let r=Date.now()+n*60*1e3,i=setInterval(()=>{let e=r-Date.now();if(e<=0)this.clearSleepTimer(),this.pause();else{let t=Math.ceil(e/6e4);this.sleepText&&(this.sleepText.textContent=`${t}m`,this.sleepText.style.display=`inline-flex`)}},1e3);e.set({sleepTimer:{mode:`minutes`,minutes:n,endTime:r},sleepTimerInterval:i}),this.sleepBtn&&(this.sleepBtn.classList.add(`active`),this.sleepBtn.title=`Hẹn giờ: ${n} phút`),this.sleepText&&(this.sleepText.textContent=`${n}m`,this.sleepText.style.display=`inline-flex`)}addSleepTimerMinutes(t=5){let{sleepTimer:n}=e.get();if(!n||n.mode!==`minutes`){this.setSleepTimer(t);return}let r=(n.endTime||Date.now())+t*60*1e3;n.endTime=r;let i=Math.ceil((r-Date.now())/6e4);n.minutes=i,e.set({sleepTimer:{...n}}),this.sleepText&&(this.sleepText.textContent=`${i}m`,this.sleepText.style.display=`inline-flex`)}showSleepTimerModal(){let t=document.getElementById(`modal-container`);if(!t)return;let{sleepTimer:n}=e.get(),r=!!n,i=()=>{let t=e.get().sleepTimer;if(!t)return``;if(t.mode===`end_of_track`)return`Dừng khi hết bài hát hiện tại`;if(t.endTime){let e=Math.max(0,Math.floor((t.endTime-Date.now())/1e3));return`Còn ${Math.floor(e/60)}:${(e%60).toString().padStart(2,`0`)}`}return``},a=[{id:`off`,label:`Tắt hẹn giờ`},{id:5,label:`5 phút`},{id:10,label:`10 phút`},{id:15,label:`15 phút`},{id:20,label:`20 phút`},{id:30,label:`30 phút`},{id:45,label:`45 phút`},{id:60,label:`60 phút`},{id:`end_of_track`,label:`Hết bài hát này`}],s=n?n.mode===`end_of_track`?`end_of_track`:n.minutes:`off`;t.innerHTML=`
      <div class="modal-overlay" id="sleep-timer-modal" style="display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.65);">
        <div class="modal-card" style="max-width:440px;width:100%;border-radius:24px 24px 0 0;padding:16px 20px 24px 20px;max-height:85vh;display:flex;flex-direction:column;animation:slideUpSheet 0.22s ease-out;background:var(--bg-surface, #1e1e24);border:1px solid var(--border-subtle);border-bottom:none;">
          <div style="width:36px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:0 auto 14px auto;"></div>
          <div class="modal-header" style="padding-bottom:12px;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
            <h3 class="modal-title" style="font-size:1.05rem;display:flex;align-items:center;gap:10px;margin:0;font-weight:700;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Hẹn giờ đi ngủ
            </h3>
            <button class="icon-btn" id="modal-sleep-close" style="min-width:32px;min-height:32px;">${o.x}</button>
          </div>

          ${r?`
            <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:var(--radius-md);padding:12px 14px;margin-top:12px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Đang hẹn giờ</div>
                <div id="sleep-modal-countdown" style="font-size:0.95rem;font-weight:700;color:var(--accent-primary, #818cf8);margin-top:2px;">
                  ${i()}
                </div>
              </div>
              <div style="display:flex;gap:8px;">
                ${n.mode===`minutes`?`
                  <button id="btn-sleep-add-5" class="pill-btn" style="min-height:30px;padding:2px 10px;font-size:0.75rem;font-weight:600;background:var(--accent-primary, #6366f1);color:#fff;">+ 5 phút</button>
                `:``}
                <button id="btn-sleep-turn-off" class="pill-btn" style="min-height:30px;padding:2px 10px;font-size:0.75rem;color:#f87171;border:1px solid rgba(248,113,113,0.3);">Tắt</button>
              </div>
            </div>
          `:``}

          <div class="modal-body" style="padding:10px 0 0 0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:55vh;">
            ${a.map(e=>{let t=String(s)===String(e.id);return`
                <button class="sleep-option-btn" data-id="${e.id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 14px;border-radius:12px;background:${t?`rgba(255,255,255,0.08)`:`transparent`};border:none;color:${t?`var(--accent-primary, #818cf8)`:`var(--text-main)`};font-size:0.92rem;font-weight:${t?`700`:`500`};text-align:left;cursor:pointer;transition:background 0.15s ease;">
                  <span>${e.label}</span>
                  ${t?`<span style="display:flex;align-items:center;color:var(--accent-primary, #818cf8);">${o.check}</span>`:``}
                </button>
              `}).join(``)}
          </div>
        </div>
      </div>
    `;let c=document.getElementById(`sleep-timer-modal`),l=document.getElementById(`modal-sleep-close`),u=document.getElementById(`btn-sleep-turn-off`),d=document.getElementById(`btn-sleep-add-5`),f=document.getElementById(`sleep-modal-countdown`),p=()=>{m&&clearInterval(m),c?.remove()};l?.addEventListener(`click`,p),c?.addEventListener(`click`,e=>{e.target===c&&p()});let m=null;r&&n.mode===`minutes`&&f&&(m=setInterval(()=>{if(!e.get().sleepTimer){clearInterval(m),p();return}f.textContent=i()},1e3)),u&&u.addEventListener(`click`,()=>{this.clearSleepTimer(),p()}),d&&d.addEventListener(`click`,()=>{this.addSleepTimerMinutes(5),f&&(f.textContent=i())}),c.querySelectorAll(`.sleep-option-btn`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.id;t===`off`?this.clearSleepTimer():t===`end_of_track`?this.setSleepTimer(`end_of_track`):this.setSleepTimer(parseInt(t,10)),p()})})}showToast(e,t=1500){}openFullPlayer(){this.fullPlayer&&(this.fullPlayer.style.display=`flex`,this.fullPlayer.classList.remove(`slide-in`),this.fullPlayer.offsetWidth,this.fullPlayer.classList.add(`slide-in`))}isFullPlayerOpen(){return!!(this.fullPlayer&&this.fullPlayer.style.display!==`none`)}closeFullPlayer(){this.fullPlayer&&(this.fullPlayer.classList.remove(`slide-in`),this.fullPlayer.style.display=`none`)}onForegroundResume(){if(!this.activeMedia)return;let t=this.activeMedia.currentTime||0,n=!this.activeMedia.paused&&!this.activeMedia.ended;e.set({isPlaying:n,currentTime:t}),this.onPlayStateChange(n),this.syncPositionState(),this.currentTimeEl&&(this.currentTimeEl.textContent=this.formatTime(t));let r=this.getDuration();if(this.totalTimeEl&&r>0&&(this.totalTimeEl.textContent=this.formatTime(r)),this.scrubberFill&&r>0){let e=t/r*100;this.scrubberFill.style.width=`${e}%`,this.scrubberHandle&&(this.scrubberHandle.style.left=`${e}%`)}this.miniProgressFill&&r>0&&(this.miniProgressFill.style.width=`${t/r*100}%`),this.fullPlayer&&this.fullPlayer.style.display!==`none`&&(this.fullPlayer.style.opacity=`1`,this.fullPlayer.style.transform=`translateY(0)`,this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent()),this.isLyricsOpen&&this.updateLyricsHighlight()}startStateSyncTimer(){setInterval(()=>{let{currentTrack:t,queue:n,loopMode:r,isShuffle:a,playbackRate:o}=e.get();if(!t)return;let s=Math.round(this.activeMedia.currentTime||0);localStorage.setItem(`cloudbeats_state`,JSON.stringify({trackId:t.id,positionSec:s,loopMode:r,isShuffle:a,playbackRate:o})),Math.abs(s-this.lastSavedPosition)>=5&&(this.lastSavedPosition=s,i.player.updateState({track_id:t.id,position_sec:s,queue:n.map(e=>e.id),loop_mode:r,shuffle:+!!a,rate:o}).catch(()=>{}))},5e3)}formatTime(e){if(isNaN(e)||e<0)return`0:00`;let t=Math.floor(e/60),n=Math.floor(e%60);return`${t}:${n<10?`0`:``}${n}`}formatRelativeTime(e){if(!e)return``;try{let t=new Date(e);if(isNaN(t.getTime()))return``;let n=Math.floor((new Date-t)/1e3);return n<60?`Vừa xong`:n<3600?`${Math.floor(n/60)} phút trước`:n<86400?`${Math.floor(n/3600)} giờ trước`:n<2592e3?`${Math.floor(n/86400)} ngày trước`:n<31536e3?`${Math.floor(n/2592e3)} tháng trước`:`${Math.floor(n/31536e3)} năm trước`}catch{return``}}notifySWCacheTrack(e){if(`serviceWorker`in navigator&&navigator.serviceWorker.controller){let t=localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`);navigator.serviceWorker.controller.postMessage({type:`CACHE_TRACK`,trackId:e,token:t})}}openLyrics(){this.closeUpNext(),this.isLyricsOpen=!0,this.lyricsView&&(this.lyricsView.style.display=`flex`),this.tabLyricsBtn&&this.tabLyricsBtn.classList.add(`active`),this.currentLyrics?this.updateLyricsHighlight(!0):this.loadLyricsForCurrentTrack()}closeLyrics(){this.isLyricsOpen=!1,this.lyricsView&&(this.lyricsView.style.display=`none`),this.tabLyricsBtn&&this.tabLyricsBtn.classList.remove(`active`)}toggleLyrics(){this.isLyricsOpen||this.lyricsView&&this.lyricsView.style.display!==`none`?this.closeLyrics():this.openLyrics()}async loadLyricsForCurrentTrack(){let t=e.get().currentTrack;if(t){this.lyricsLoadingTrackId=t.id,this.lyricsLoading&&(this.lyricsLoading.style.display=`flex`),this.lyricsEmpty&&(this.lyricsEmpty.style.display=`none`),this.lyricsLinesWrapper&&(this.lyricsLinesWrapper.innerHTML=``),this.lyricsTrackTitle&&(this.lyricsTrackTitle.textContent=`${t.title} • ${t.artist||`Nghệ sĩ`}`);try{let e=await m(t.id);if(e&&e.lyrics&&(e.lyrics.hasSynced||e.lyrics.plainLyrics)){if(this.lyricsLoadingTrackId!==t.id)return;this.lyricsLoading&&(this.lyricsLoading.style.display=`none`),this.currentLyrics=e.lyrics,this.renderLyrics(e.lyrics);return}}catch{}try{let e=t.youtubeId||(t.id&&t.id.startsWith(`yt_`)?t.id.split(`_`)[1]:``),n=await i.lyrics.get({trackId:t.isOnline?``:t.id,youtubeId:e,title:t.title,artist:t.artist||``,duration:t.duration_sec||0});if(this.lyricsLoadingTrackId!==t.id)return;this.lyricsLoading&&(this.lyricsLoading.style.display=`none`),n.success&&(n.hasSynced||n.plainLyrics)?(this.currentLyrics=n,this.renderLyrics(n)):(this.currentLyrics=null,this.lyricsEmpty&&(this.lyricsEmpty.style.display=`flex`))}catch(e){console.warn(`Error loading lyrics:`,e),this.lyricsLoading&&(this.lyricsLoading.style.display=`none`),this.lyricsEmpty&&(this.lyricsEmpty.style.display=`flex`)}}}renderLyrics(e){if(this.lyricsLinesWrapper){if(this.lyricsLinesWrapper.innerHTML=``,e.hasSynced&&e.parsedLyrics?.length>0)this.lyricsLinesWrapper.innerHTML=e.parsedLyrics.map((e,t)=>{let n=e.text||`...`;return`<div class="lyric-line" data-time="${e.time}" data-index="${t}">${this.escapeHtml(n)}</div>`}).join(``),this.lyricsLinesWrapper.querySelectorAll(`.lyric-line`).forEach(e=>{e.addEventListener(`click`,()=>{let t=parseFloat(e.dataset.time);isNaN(t)||(this.seek(t),this.play())})}),this.updateLyricsHighlight(!0);else if(e.plainLyrics){let t=e.plainLyrics.split(`
`);this.lyricsLinesWrapper.innerHTML=t.map(e=>{let t=e.trim();return t?`<div class="lyric-line plain">${this.escapeHtml(t)}</div>`:`<div style="height:12px;"></div>`}).join(``)}}}updateLyricsHighlight(e=!1){if(!this.isLyricsOpen||!this.currentLyrics?.hasSynced)return;let t=this.activeMedia.currentTime||0,n=this.currentLyrics.parsedLyrics||[];if(n.length===0)return;let r=-1;for(let e=0;e<n.length&&t>=n[e].time;e++)r=e;(r!==this.currentLyricIndex||e)&&(this.currentLyricIndex=r,this.lyricsLinesWrapper.querySelectorAll(`.lyric-line`).forEach((e,t)=>{if(t===r){if(e.classList.add(`active`),this.lyricsScrollContainer){let t=this.lyricsScrollContainer,n=e.offsetTop-t.clientHeight/2+e.clientHeight/2;t.scrollTo({top:Math.max(0,n),behavior:`smooth`})}}else e.classList.remove(`active`)}))}openUpNext(){this.closeLyrics(),this.upNextView&&(this.upNextView.style.display=`flex`),this.tabUpNextBtn&&this.tabUpNextBtn.classList.add(`active`),this.renderUpNextContent()}closeUpNext(){this.upNextView&&(this.upNextView.style.display=`none`),this.tabUpNextBtn&&this.tabUpNextBtn.classList.remove(`active`)}toggleUpNext(){this.upNextView&&this.upNextView.style.display!==`none`?this.closeUpNext():this.openUpNext()}renderUpNextContent(){if(!this.upNextContentWrapper)return;let{queue:t,currentTrack:n,isLibraryQueue:r}=e.get();if(this.upNextSubtitle&&(this.upNextSubtitle.textContent=``),!t||t.length===0){this.upNextContentWrapper.innerHTML=`
        <div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:0.85rem;background:var(--bg-surface);border-radius:var(--radius-md);">
          Danh sách phát trống.
        </div>
      `;return}let i=r?`Danh sách phát thư viện`:`Danh sách phát`,a=!r&&n?.genre?`<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:var(--accent-glow, rgba(99,102,241,0.15));color:var(--accent-primary, #6366f1);font-weight:600;text-transform:none;">${this.escapeHtml(n.genre)}</span>`:``,s=!r&&this.isFetchingSimilar?`<span style="font-size:0.72rem;color:var(--accent-primary);text-transform:none;display:inline-flex;align-items:center;gap:4px;"><svg class="spin-loader" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Đang thêm...</span>`:``;this.upNextContentWrapper.innerHTML=`
      <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.06em;color:var(--text-secondary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
          ${o.music}
          <span>${i} (${t.length})</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${a}
          ${s}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;">
        ${t.map((e,t)=>{let r=e.id===n?.id||e.youtubeId&&n?.youtubeId&&e.youtubeId===n.youtubeId,i=e.isOnline?e.thumbnail_url||`https://i.ytimg.com/vi/${e.youtubeId}/hqdefault.jpg`:`/api/tracks/${e.id}/thumb`;return`
            <div class="ytm-queue-item ${r?`active`:``}" data-id="${e.id}">
              <div class="ytm-item-index" style="${r?`color:var(--accent-primary, #10b981);font-weight:bold;`:``}">
                ${r?o.play:t+1}
              </div>
              <div class="ytm-item-thumb-box" style="position:relative;">
                <img class="ytm-item-thumb" src="${i}" alt="" loading="lazy">
                <span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);border-radius:3px;padding:1px;display:flex;color:#fff;">
                  ${e.media_type===`video`?o.videoFile:o.audioFile}
                </span>
              </div>
              <div class="ytm-item-info">
                <div class="ytm-item-title" title="${this.escapeHtml(e.title)}" style="${r?`color:var(--accent-primary, #10b981);font-weight:bold;`:``}">
                  ${this.escapeHtml(e.title)}
                </div>
                <div class="ytm-item-artist">
                  ${this.escapeHtml(e.artist||`Nghệ sĩ`)}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="ytm-item-duration">
                  ${this.formatTime(e.duration_sec||0)}
                </div>
                ${e.isOnline?`
                  <button class="icon-btn btn-upnext-dl" data-id="${e.id}" title="Tải bài này về máy" style="width:30px;height:30px;border-radius:50%;color:var(--text-muted);">
                    ${o.download}
                  </button>
                `:``}
              </div>
            </div>
          `}).join(``)}
      </div>
    `,this.upNextContentWrapper.querySelectorAll(`.ytm-queue-item`).forEach(e=>{e.addEventListener(`click`,n=>{if(n.target.closest(`.btn-upnext-dl`))return;let r=e.dataset.id,i=t.find(e=>e.id===r);i&&(i.isOnline?this.loadOnlineTrack(i,!1):this.loadTrack(i,!0,0,!1))})}),this.upNextContentWrapper.querySelectorAll(`.btn-upnext-dl`).forEach(e=>{e.addEventListener(`click`,r=>{r.stopPropagation();let i=e.dataset.id,a=n&&n.id===i?n:t.find(e=>e.id===i);a&&this.downloadTrackAudio(a,e)})}),setTimeout(()=>{let e=this.upNextContentWrapper.querySelector(`.ytm-queue-item.active`);e&&e.scrollIntoView({block:`nearest`,behavior:`smooth`})},80)}updateTrackGenre(t,n,r,i=[]){let{currentTrack:a}=e.get();if(a){if(a.genre=t,a.topic=n,a.isMusic=r,a.chips=i,e.set({currentTrack:{...a}}),this.playerTypeBadge){let e=a.media_type===`video`;this.playerTypeBadge.innerHTML=e?`${o.videoFile} Video`:`${o.audioFile} Audio`}this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent()}}showDownloadModalForTrack(e,t=null){this.downloadTrackAudio(e,t)}async downloadTrackAudio(t,n=null){if(!t){this.showToast(`Không có bài nào đang phát`,1500);return}s(n||this.playerDownloadBtn||document.getElementById(`player-thumb`),t);let r=t.soundcloudId||t.youtubeId;if(!r&&t.id&&(r=typeof t.id==`string`?t.id.startsWith(`sc_`)||t.id.startsWith(`yt_`)?t.id.split(`_`)[1]:t.id:String(t.id)),!r&&t.source_url){let e=t.source_url.match(/(?:tracks\/|v=)([a-zA-Z0-9_-]+)/);e&&(r=e[1])}if(!r&&t.url){let e=t.url.match(/(?:tracks\/|v=)([a-zA-Z0-9_-]+)/);e&&(r=e[1])}if(!r){this.showToast(`Tệp này đã có sẵn trong thư viện cá nhân`,2500);return}let a=t.title||`bài hát`,o=t.artist||t.channel||``;this.showToast(`Đang thêm audio "${a}" vào tiến trình tải...`,2e3);try{await i.soundcloud.download({url:t.url||(r?`https://soundcloud.com/tracks/${r}`:null),id:r,mediaType:`audio`,quality:`HQ`,title:a,artist:o,thumbnail:t.thumbnail||t.thumbnail_url}),this.showToast(`Đã thêm "${a}" vào danh sách tác vụ tải!`,3e3);try{let t=await i.jobs.list();e.setJobs(t)}catch{}}catch(e){console.error(`Download error:`,e),this.showToast(`Lỗi tải: ${e.message}`,3e3)}}showUpNextModal(){this.openFullPlayer(),this.openUpNext()}showQueueModal(){this.showUpNextModal()}async fetchAndQueueSimilarTracks(t){if(!t)return;let{isPlaylistMode:n,isLibraryQueue:r}=e.get();if(n||t.isPlaylist||r||!t.isOnline||this.isFetchingSimilar)return;let a=t.youtubeId;if(!a&&t.source_url){let e=t.source_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);e&&(a=e[1])}if(!a&&t.title&&navigator.onLine)try{let e=`${t.title} ${t.artist||``}`.trim(),n=await i.youtube.search(e,{limit:1});n?.items?.[0]?.id&&(a=n.items[0].id)}catch(e){console.warn(`Could not resolve YouTube ID for track:`,e)}if(a){this.isFetchingSimilar=!0,this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent();try{let n=await i.youtube.getRelated(a),r=e.get().currentTrack;if(!r||r.id!==t.id&&r.youtubeId!==a)return;if(n&&(n.genre&&this.updateTrackGenre(n.genre,n.topic,n.isMusic,n.chips||[]),n.items&&n.items.length>0)){let r=t.media_type||`audio`,i=n.items.filter(e=>e.id!==a).map(e=>({id:`yt_${e.id}_${r}`,youtubeId:e.id,title:e.title,artist:e.channel||`Nghệ sĩ`,album:n.topic||n.genre||`Radio Trực Tuyến`,genre:n.genre||``,duration_sec:e.duration||0,media_type:r,isOnline:!0,thumbnail_url:e.thumbnail})),{queue:o}=e.get(),s=new Set(o.map(e=>e.youtubeId||e.id&&e.id.replace(`yt_`,``).split(`_`)[0])),c=i.filter(e=>!s.has(e.youtubeId));if(c.length>0){let t=[...o,...c];e.set({queue:t,originalQueue:t})}}}catch(e){console.warn(`Failed to fetch similar tracks:`,e.message)}finally{this.isFetchingSimilar=!1,this.upNextView&&this.upNextView.style.display!==`none`&&this.renderUpNextContent()}}}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`):``}};function b(e){return e?String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`):``}async function x({trackIds:t=[],trackTitle:n=``,onSuccess:r=null}){if(!t||t.length===0)return;let a=document.getElementById(`modal-container`),s=n||`${t.length} bài hát`;a.innerHTML=`
    <div class="modal-overlay" id="add-to-pl-modal">
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <div style="min-width:0;flex:1;">
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              ${o.queue} Thêm vào Playlist
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">
              ${b(s)}
            </div>
          </div>
          <button class="icon-btn" id="modal-close" style="margin-left:8px;">${o.x}</button>
        </div>

        <div class="modal-body" style="padding:16px;">
          <!-- Quick create playlist row -->
          <div style="margin-bottom:16px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;display:block;">
              Tạo playlist mới
            </label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="quick-create-pl-input" class="form-input" placeholder="Nhập tên playlist mới..." style="padding:8px 12px;font-size:0.9rem;">
              <button id="btn-quick-create-pl" class="btn-primary" style="white-space:nowrap;min-height:38px;padding:0 14px;font-size:0.85rem;">
                ${o.plus} Tạo & Thêm
              </button>
            </div>
          </div>

          <!-- Existing playlists list -->
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;display:block;">
              Chọn playlist có sẵn
            </label>
            <div id="add-pl-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-right:2px;">
              <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">
                Đang tải danh sách playlist...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;let c=document.getElementById(`add-to-pl-modal`),l=c.querySelector(`#modal-close`),u=()=>c.remove();l.addEventListener(`click`,u),c.addEventListener(`click`,e=>{e.target===c&&u()});let d=c.querySelector(`#add-pl-list`),f=c.querySelector(`#quick-create-pl-input`),p=c.querySelector(`#btn-quick-create-pl`),m=async(e,n)=>{try{await i.playlists.addTracks(e,t),`${n}`,u(),r&&r({id:e,name:n})}catch(e){alert(`Lỗi thêm vào playlist: `+e.message)}},h=async()=>{let e=f.value.trim();if(!e){f.focus();return}p.disabled=!0,p.textContent=`Đang tạo...`;try{let n=await i.playlists.create(e);await i.playlists.addTracks(n.id,t),`${n.name}${s}`,u(),r&&r(n)}catch(e){alert(`Lỗi tạo playlist: `+e.message),p.disabled=!1,p.innerHTML=`${o.plus} Tạo & Thêm`}};p.addEventListener(`click`,h),f.addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),h())});try{let t=await i.playlists.list();if(e.set({playlists:t}),!t||t.length===0){d.innerHTML=`
        <div style="text-align:center;padding:20px 10px;color:var(--text-muted);font-size:0.85rem;background:var(--bg-surface);border-radius:var(--radius-md);">
          Chưa có playlist nào. Hãy nhập tên ở trên để tạo ngay!
        </div>
      `;return}d.innerHTML=t.map(e=>`
      <div class="track-item pl-select-item" data-id="${e.id}" style="padding:10px 12px;border-radius:var(--radius-md);cursor:pointer;border:1px solid var(--border-subtle);background:var(--bg-surface);">
        <div class="track-thumb-wrap" style="width:40px;height:40px;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;color:#fff;border-radius:8px;flex-shrink:0;overflow:hidden;position:relative;">
          <img src="/api/playlists/${e.id}/thumb?t=${encodeURIComponent(e.updated_at||``)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">${o.queue}</div>
        </div>
        <div class="track-meta" style="min-width:0;flex:1;">
          <div class="track-title" style="font-size:0.95rem;font-weight:600;">${b(e.name)}</div>
          <div class="track-sub" style="font-size:0.78rem;color:var(--text-muted);">${e.track_count||0} bài hát</div>
        </div>
        <button class="btn-secondary" style="min-height:32px;padding:0 10px;font-size:0.8rem;border-radius:16px;">
          + Thêm
        </button>
      </div>
    `).join(``),d.querySelectorAll(`.pl-select-item`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.id,r=t.find(e=>e.id===n);r&&m(r.id,r.name)})})}catch(e){d.innerHTML=`
      <div style="text-align:center;padding:12px;color:var(--accent-danger);font-size:0.85rem;">
        Lỗi tải danh sách: ${b(e.message)}
      </div>
    `}}async function S({playlistId:e,playlistName:t,currentTrackIds:n=[],onSuccess:r=null}){let a=document.getElementById(`modal-container`),s=new Set(n);a.innerHTML=`
    <div class="modal-overlay" id="picker-to-pl-modal">
      <div class="modal-card" style="max-width:540px;height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <div style="min-width:0;flex:1;">
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              ${o.plus} Thêm bài vào "${b(t)}"
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
              Chọn các bài hát từ thư viện
            </div>
          </div>
          <button class="icon-btn" id="modal-close">${o.x}</button>
        </div>

        <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:12px;">
          <!-- Search input -->
          <div class="search-input-box" style="margin:0;flex:1;">
            ${o.search}
            <input type="text" id="picker-search-input" placeholder="Tìm kiếm bài hát, ca sĩ..." style="font-size:0.9rem;">
          </div>
          <span id="picker-total-indicator" style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">0 bài</span>
        </div>

        <div id="picker-tracks-list" style="flex:1;overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:6px;">
          <div style="text-align:center;padding:30px;color:var(--text-muted);">
            Đang tải thư viện bài hát...
          </div>
        </div>

        <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border-subtle);">
          <span id="picker-selected-summary" style="font-size:0.85rem;font-weight:600;color:var(--text-main);">
            Đã chọn 0 bài mới
          </span>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary" id="picker-cancel-btn" style="min-height:36px;padding:0 14px;">Hủy</button>
            <button class="btn-primary" id="picker-submit-btn" style="min-height:36px;padding:0 16px;" disabled>
              + Thêm vào Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  `;let c=document.getElementById(`picker-to-pl-modal`),l=c.querySelector(`#modal-close`),u=c.querySelector(`#picker-cancel-btn`),d=c.querySelector(`#picker-submit-btn`),f=c.querySelector(`#picker-search-input`),p=c.querySelector(`#picker-tracks-list`),m=c.querySelector(`#picker-total-indicator`),h=c.querySelector(`#picker-selected-summary`),g=()=>c.remove();l.addEventListener(`click`,g),u.addEventListener(`click`,g),c.addEventListener(`click`,e=>{e.target===c&&g()});let _=[],v=``,y=new Set,x=()=>{let e=y.size;h.textContent=`Đã chọn ${e} bài mới`,d.disabled=e===0,d.textContent=e>0?`+ Thêm (${e} bài)`:`+ Thêm vào Playlist`},S=()=>{let e=_;if(v){let t=v.toLowerCase();e=e.filter(e=>e.title&&e.title.toLowerCase().includes(t)||e.artist&&e.artist.toLowerCase().includes(t))}if(m.textContent=`${e.length} bài`,e.length===0){p.innerHTML=`
        <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.9rem;">
          Không tìm thấy bài hát nào phù hợp.
        </div>
      `;return}p.innerHTML=e.map(e=>{let t=s.has(e.id),n=t||y.has(e.id);return`
        <label class="track-item picker-row ${t?`already-in`:``}" style="padding:8px 10px;border-radius:var(--radius-md);cursor:${t?`default`:`pointer`};opacity:${t?`0.65`:`1`};">
          <input type="checkbox" class="picker-check" data-id="${e.id}" ${n?`checked`:``} ${t?`disabled`:``} style="margin-right:10px;width:18px;height:18px;accent-color:var(--accent-primary);">
          
          <div class="track-thumb-wrap" style="width:38px;height:38px;flex-shrink:0;">
            <img class="track-thumb" src="/api/tracks/${e.id}/thumb" alt="" loading="lazy">
          </div>

          <div class="track-meta" style="min-width:0;flex:1;">
            <div class="track-title" style="font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b(e.title)}</div>
            <div class="track-sub" style="font-size:0.75rem;color:var(--text-muted);">
              <span>${b(e.artist||`Nghệ sĩ`)}</span>
            </div>
          </div>

          ${t?`
            <span style="font-size:0.75rem;color:var(--accent-primary);background:rgba(99,102,241,0.12);padding:2px 8px;border-radius:12px;white-space:nowrap;">
              Đã có
            </span>
          `:``}
        </label>
      `}).join(``),p.querySelectorAll(`.picker-check`).forEach(e=>{e.addEventListener(`change`,()=>{let t=e.dataset.id;e.checked?y.add(t):y.delete(t),x()})})},ee=null;f.addEventListener(`input`,e=>{clearTimeout(ee),ee=setTimeout(()=>{v=e.target.value.trim(),S()},200)}),d.addEventListener(`click`,async()=>{if(y.size!==0){d.disabled=!0,d.textContent=`Đang thêm...`;try{let n=Array.from(y);await i.playlists.addTracks(e,n),`${n.length}${t}`,g(),r&&r()}catch(e){alert(`Lỗi thêm bài: `+e.message),d.disabled=!1,x()}}});try{_=(await i.tracks.list({sort:`created_desc`})).tracks||[],S()}catch(e){p.innerHTML=`
      <div style="text-align:center;padding:20px;color:var(--accent-danger);">
        Lỗi tải thư viện: ${b(e.message)}
      </div>
    `}}var ee=class{constructor(e){this.onClose=e,this.container=document.getElementById(`modal-container`),this.unsubscribe=null,this.storagePollTimer=null}show(){this.render(),this.unsubscribe=e.subscribe(()=>this.updateList()),this.loadStorage(),this.storagePollTimer=setInterval(()=>this.loadStorage(),1e4)}formatBytes(e){if(!e||e<=0)return`0 MB`;let t=e/1048576;return t>=1024?`${(t/1024).toFixed(2)} GB (${Math.round(t)} MB)`:`${t.toFixed(1)} MB`}async loadStorage(){try{let e=await i.system.storage(),t=document.getElementById(`jobs-storage-val`);t&&e&&(t.textContent=this.formatBytes(e.totalUsedBytes||e.mediaBytes))}catch{}}shortenTitle(e,t=32){if(!e)return``;let n=String(e).replace(/\[(?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio|Lyric\s*Video)\]/gi,``).replace(/\((?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio|Lyric\s*Video)\)/gi,``).replace(/\|\s*(?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio).*/gi,``).replace(/\s{2,}/g,` `).trim();return n.length<=t?n:n.slice(0,t).trim()+`…`}render(){this.container.innerHTML=`
      <div class="modal-overlay" id="jobs-overlay">
        <div class="modal-card" style="max-width:440px;width:92%;">
          <div class="modal-header" style="padding:12px 14px 8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <h3 class="modal-title" style="font-size:1rem;margin:0;">Tác vụ chuyển đổi</h3>
              <span id="jobs-count-badge" class="badge" style="position:static;font-size:0.7rem;padding:2px 7px;">0</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="pill-btn" id="btn-clear-completed" style="font-size:0.7rem;padding:2px 8px;min-height:24px;">Xóa đã xong</button>
              <button class="icon-btn" id="modal-close" style="width:28px;height:28px;padding:4px;">${o.x}</button>
            </div>
          </div>

          <!-- Storage Used Bar -->
          <div style="padding:0 14px 8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid var(--border-subtle);font-size:0.74rem;">
              <div style="display:flex;align-items:center;gap:5px;color:var(--text-muted);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
                <span>Đã dùng:</span>
              </div>
              <span id="jobs-storage-val" style="font-weight:600;color:var(--text-primary);letter-spacing:0.2px;">Đang tải...</span>
            </div>
          </div>

          <div class="modal-body" id="jobs-list" style="display:flex;flex-direction:column;gap:6px;max-height:55vh;padding:4px 14px 14px;overflow-y:auto;">
            <div class="empty-state" style="padding:20px 10px;font-size:0.85rem;">Đang tải danh sách tác vụ...</div>
          </div>
        </div>
      </div>
    `;let t=document.getElementById(`jobs-overlay`);t.querySelector(`#modal-close`).addEventListener(`click`,()=>{this.close(t)}),t.querySelector(`#btn-clear-completed`).addEventListener(`click`,async()=>{try{await i.jobs.clearCompleted();let t=await i.jobs.list();e.setJobs(t),this.loadStorage()}catch(e){console.error(e)}}),this.updateList()}close(e){this.unsubscribe&&this.unsubscribe(),this.storagePollTimer&&clearInterval(this.storagePollTimer),e.remove(),this.onClose&&this.onClose()}updateList(){let t=document.getElementById(`jobs-list`),n=document.getElementById(`jobs-count-badge`);if(!t)return;let r=e.get().jobs||[],a=r.filter(e=>e.status===`downloading`||e.status===`processing`||e.deviceSaving).length+r.filter(e=>e.status===`queued`).length;if(n&&(n.textContent=a),r.length===0){t.innerHTML=`
        <div class="empty-state" style="padding:20px 10px;">
          <p class="empty-title" style="font-size:0.9rem;margin-bottom:4px;">Không có tác vụ nào</p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Các tệp tải hoặc chuyển đổi sẽ hiển thị tại đây.</p>
        </div>
      `;return}t.innerHTML=r.map(e=>{let t=e.deviceSaving||!1,n=e.status===`downloading`||e.status===`processing`||t,r=e.status===`queued`,i=e.status===`error`,a=e.status===`done`&&!t,o=e.status===`canceled`,s=``;t?s=`<span style="color:#f59e0b;font-weight:600;display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span>Lưu máy${e.deviceLoadedMb&&e.deviceTotalMb?` ${e.deviceLoadedMb}/${e.deviceTotalMb}MB`:``}${e.deviceProgress?` (${e.deviceProgress}%)`:``}</span>`:n?s=`<span style="color:#60a5fa;font-weight:600;">${e.status===`downloading`?`Tải`:`Xử lý`} ${Math.round(e.progress||0)}%</span>`:r?s=`<span style="color:var(--text-muted);">Xếp hàng</span>`:a?s=`<span style="color:#34d399;font-weight:600;display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;"></span>Sẵn sàng</span>`:i?s=`<span style="color:#f87171;font-weight:600;">Lỗi</span>`:o&&(s=`<span style="color:var(--text-muted);">Hủy</span>`);let c={};try{typeof e.extra==`string`?c=JSON.parse(e.extra):typeof e.extra==`object`&&e.extra&&(c=e.extra)}catch{}let l=c?.title||e.title||(e.kind===`youtube`?`Trực tuyến`:`Chuyển đổi`)+` - `+(e.url||e.track_id||`Media`),u=this.shortenTitle(l,30),d=c?.artist?this.shortenTitle(c.artist,18):``;return`
        <div style="background:var(--bg-surface);padding:7px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="min-width:0;flex:1;">
              <div style="font-size:0.83rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;" title="${this.escapeHtml(l)}">
                ${this.escapeHtml(u)}
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${d?`<span>${this.escapeHtml(d)}</span><span>•</span>`:``}
                <span>${e.media_type===`video`?`Video`:`Audio`}</span>
                <span>•</span>
                ${s}
                ${e.speed?`<span>• ${e.speed}</span>`:``}
              </div>
            </div>

            <div style="display:flex;gap:4px;flex-shrink:0;">
              ${n||r?`
                <button class="pill-btn job-cancel-btn" data-id="${e.id}" style="min-height:24px;padding:1px 8px;font-size:0.7rem;">Hủy</button>
              `:``}
              ${i?`
                <button class="pill-btn job-retry-btn" data-id="${e.id}" style="min-height:24px;padding:1px 8px;font-size:0.7rem;">Thử lại</button>
              `:``}
            </div>
          </div>

          ${n?`
            <div style="height:3px;background:var(--border-subtle);border-radius:2px;overflow:hidden;margin-top:5px;">
              <div style="height:100%;width:${t?e.deviceProgress||10:e.progress||0}%;background:${t?`linear-gradient(90deg, #f59e0b, #10b981)`:`var(--accent-gradient)`};transition:width 0.15s ease;"></div>
            </div>
          `:``}

          ${i&&e.error?`
            <div style="font-size:0.7rem;color:#f87171;margin-top:4px;background:rgba(244,63,94,0.08);padding:3px 6px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(e.error)}">
              ${this.escapeHtml(e.error)}
            </div>
          `:``}
        </div>
      `}).join(``),t.querySelectorAll(`.job-cancel-btn`).forEach(e=>{e.addEventListener(`click`,async()=>{try{await i.jobs.cancel(e.dataset.id)}catch(e){console.error(e)}})}),t.querySelectorAll(`.job-retry-btn`).forEach(e=>{e.addEventListener(`click`,async()=>{try{await i.jobs.retry(e.dataset.id)}catch(e){console.error(e)}})})}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}},te=class{constructor(e){this.player=e,this.container=document.getElementById(`main-view`),this.cachedTrackIds=new Set,this.syncingTrackIds=new Set,this.syncProgressMap=new Map,this._progressRafId=null,this._pendingJobUpdates=new Map}async render(){let{libraryFilter:t,searchQuery:n,sortBy:r}=e.get();this.container.innerHTML=`
      <div class="library-header" style="margin-bottom:12px;">
        <!-- Search Bar & Compact Sync Button -->
        <div class="search-bar-row" style="display:flex;align-items:center;gap:8px;">
          <div class="search-input-box" style="flex:1;">
            ${o.search}
            <input type="text" id="lib-search-input" placeholder="Tìm theo bài hát, ca sĩ, album..." value="${n||``}">
            ${n?`<button id="lib-search-clear" class="icon-btn" style="min-height:32px;min-width:32px;">${o.x}</button>`:``}
          </div>
          <button id="btn-sync-offline" class="pill-btn" style="font-size:0.76rem;padding:0 10px;min-height:36px;gap:5px;background:var(--bg-surface);border:1px solid var(--border-subtle);display:flex;align-items:center;cursor:pointer;border-radius:18px;color:var(--text-primary);flex-shrink:0;" title="Đồng bộ về máy">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Đồng bộ</span>
          </button>
        </div>

        <!-- Tracks List -->
        <div id="tracks-container" class="track-list" style="margin-top:10px;">
          <div class="empty-state">Đang tải thư viện...</div>
        </div>
      </div>
    `,this.bindEvents(),await this.fetchAndRenderTracks()}bindEvents(){let t=document.getElementById(`lib-search-input`),n=null;t.addEventListener(`input`,t=>{clearTimeout(n),n=setTimeout(()=>{e.set({searchQuery:t.target.value}),this.fetchAndRenderTracks()},300)});let r=document.getElementById(`lib-search-clear`);r&&r.addEventListener(`click`,()=>{t.value=``,e.set({searchQuery:``}),this.render()});let i=document.getElementById(`btn-sync-offline`);i&&i.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),this.handleManualSync(i)}),window.app?.updateHeaderJobsBadge()}async fetchAndRenderTracks(){let{libraryFilter:t,searchQuery:n,sortBy:r}=e.get(),a=document.getElementById(`tracks-container`);a&&(!a.children||a.children.length===0||a.querySelector(`.empty-state`))&&(a.innerHTML=[,,,,,,].fill(0).map(()=>`
        <div class="skeleton-track-row">
          <div class="skeleton-shimmer skeleton-thumb-square"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:65%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:35%;"></div>
          </div>
        </div>
      `).join(``));try{let t=await i.tracks.list({type:``,q:n,sort:r}),a=e.get().pendingDeviceTrackIds||window.app?.pendingDeviceSaveTrackIds,o=t.tracks||[],s=a&&a.size>0?o.filter(e=>!a.has(e.id)):o;e.set({tracks:s,totalTracks:t.total||s.length});try{localStorage.setItem(`muzifi_cached_library`,JSON.stringify(s))}catch{}try{let e=await h();this.cachedTrackIds=new Set(e)}catch{}this.renderTrackItems(s),this.checkCachedTracks()}catch{let t=e.get().tracks||[];if(t.length===0)try{let e=localStorage.getItem(`muzifi_cached_library`)||localStorage.getItem(`metube_cached_library`);e&&(t=JSON.parse(e))}catch{}if(t.length>0){let e=t;if(n&&n.trim()){let t=n.toLowerCase().trim();e=e.filter(e=>e.title&&e.title.toLowerCase().includes(t)||e.artist&&e.artist.toLowerCase().includes(t)||e.album&&e.album.toLowerCase().includes(t))}try{let e=await h();this.cachedTrackIds=new Set(e)}catch{}this.renderTrackItems(e),this.checkCachedTracks()}else a&&(a.innerHTML=`
          <div class="empty-state">
            <p class="empty-title">Đang ở chế độ Offline</p>
            <p>Chưa có dữ liệu bài hát nào được lưu trong bộ nhớ đệm.</p>
          </div>
        `)}}async checkCachedTracks(){try{this.cachedTrackIds=await h(),this.updateCachedBadges()}catch(e){console.warn(`checkCachedTracks error:`,e)}}updateCachedBadges(){let t=document.getElementById(`tracks-container`);if(!t)return;let n=e.get().tracks||[];t.querySelectorAll(`.track-item`).forEach(e=>{let t=e.dataset.id,r=this.cachedTrackIds&&this.cachedTrackIds.has(t),i=this.syncingTrackIds&&this.syncingTrackIds.has(t),a=e.querySelector(`.track-sync-actions`);if(a&&!i){if(r)a.querySelector(`.track-offline-badge.cached`)||(a.innerHTML=`
            <div class="track-offline-badge cached pop-in" title="Đã lưu trên thiết bị (Offline)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
          `);else if(!a.querySelector(`.btn-sync-single-track`)){let r=n.find(e=>e.id===t);a.innerHTML=`
            <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${t}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Tải</span>
            </button>
          `;let i=a.querySelector(`.btn-sync-single-track`);i&&r&&i.addEventListener(`click`,t=>{t.stopPropagation(),t.preventDefault(),this.syncSingleTrack(r,e)})}}})}updateTrackRowSyncProgress(e,t){let n=document.querySelector(`.track-item[data-id="${e}"]`);if(!n)return;let r=n.querySelector(`.track-sync-actions`);if(r){let e=r.querySelector(`.track-sync-pct`);e?e.textContent=`${t.percent||0}%`:r.innerHTML=`
          <div class="track-sync-progress" title="Đang tải về máy...">
            <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="track-sync-pct">${t.percent||0}%</span>
          </div>
        `}}_scheduleProgressFlush(){this._progressRafId||=requestAnimationFrame(()=>{this._progressRafId=null,this._flushPendingJobUpdates()})}_flushPendingJobUpdates(){for(let[,{syncJob:t,prog:n}]of this._pendingJobUpdates)t.deviceProgress=n.percent,t.deviceLoadedMb=n.loadedMb,t.deviceTotalMb=n.totalMb,t.progress=n.percent,e.updateJob(t);this._pendingJobUpdates.clear(),window.app?.updateHeaderJobsBadge?.()}markTrackRowCached(e){let t=document.querySelector(`.track-item[data-id="${e}"]`);if(!t)return;let n=t.querySelector(`.track-sync-actions`);n&&(n.innerHTML=`
        <div class="track-offline-badge cached pop-in" title="Đã lưu trên thiết bị (Offline)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
      `)}async syncSingleTrack(t,n){if(!t||!t.id||this.syncingTrackIds.has(t.id)||this.cachedTrackIds.has(t.id))return;if(this.syncingTrackIds.add(t.id),this.syncProgressMap.set(t.id,{percent:0,loadedMb:`0.0`,totalMb:`0.0`}),n){let e=n.querySelector(`.track-sync-actions`);e&&(e.innerHTML=`
          <div class="track-sync-progress" title="Đang tải về máy...">
            <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="track-sync-pct">0%</span>
          </div>
        `)}let r=`sync_${t.id}`,i={id:r,track_id:t.id,title:t.title,status:`downloading`,deviceSaving:!0,deviceProgress:1,deviceLoadedMb:`0.0`,deviceTotalMb:`0.0`,progress:1};e.updateJob(i),window.app?.updateHeaderJobsBadge?.();try{await _(t,``,e=>{this.syncProgressMap.set(t.id,e),this.updateTrackRowSyncProgress(t.id,e),this._pendingJobUpdates.set(t.id,{syncJob:i,prog:e}),this._scheduleProgressFlush()}),this.cachedTrackIds.add(t.id),this.markTrackRowCached(t.id),this.player?.showToast(`Đã lưu "${t.title}" về máy (Offline)`)}catch(e){if(console.warn(`syncSingleTrack failed:`,e),this.player?.showToast(`Lỗi tải "${t.title}": ${e.message}`),n){let e=n.querySelector(`.track-sync-actions`);if(e){e.innerHTML=`
            <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${t.id}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Thử lại</span>
            </button>
          `;let r=e.querySelector(`.btn-sync-single-track`);r&&r.addEventListener(`click`,e=>{e.stopPropagation(),e.preventDefault(),this.syncSingleTrack(t,n)})}}}finally{this.syncingTrackIds.delete(t.id),this.syncProgressMap.delete(t.id);let n=(e.get().jobs||[]).filter(e=>e.id!==r);e.setJobs(n),window.app?.updateHeaderJobsBadge?.()}}renderTrackItems(t){let n=document.getElementById(`tracks-container`);if(!t||t.length===0){n.innerHTML=`
        <div class="empty-state">
          <div class="empty-icon">${o.music}</div>
          <p class="empty-title">Chưa có bài hát nào</p>
          <p>Chuyển sang tab Trực tuyến để tìm kiếm và tải nhạc về máy.</p>
        </div>
      `;return}let{currentTrack:r,isPlaying:i}=e.get();n.innerHTML=t.map(e=>{let t=r&&r.id===e.id,n=this.cachedTrackIds&&this.cachedTrackIds.has(e.id),i=this.syncingTrackIds&&this.syncingTrackIds.has(e.id),a=this.syncProgressMap.get(e.id),o=this.player.formatTime(e.duration_sec||0),s=e.created_at&&this.player.formatRelativeTime?this.player.formatRelativeTime(e.created_at):``;return`
        <div class="track-item ${t?`playing`:``}" data-id="${e.id}">
          <div class="track-thumb-wrap">
            <img class="track-thumb" src="/api/tracks/${e.id}/thumb" alt="Cover" loading="lazy">
          </div>

          <div class="track-meta" style="flex:1;min-width:0;">
            <div class="track-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${this.escapeHtml(e.title)}
            </div>
            <div class="track-sub">
              <span>${this.escapeHtml(e.artist||`Nghệ sĩ`)}</span>
              <span>•</span>
              <span>${o}</span>
              ${s?`<span>•</span><span>${s}</span>`:``}
            </div>
          </div>

          <div class="track-sync-actions">
            ${n?`
              <div class="track-offline-badge cached" title="Đã lưu trên thiết bị (Offline)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
            `:i?`
              <div class="track-sync-progress" title="Đang tải về máy...">
                <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span class="track-sync-pct">${a?a.percent:0}%</span>
              </div>
            `:`
              <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${e.id}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Tải</span>
              </button>
            `}
          </div>
        </div>
      `}).join(``),n.querySelectorAll(`.track-item`).forEach(n=>{let r=null,i=!1,a=n.dataset.id,o=t.find(e=>e.id===a);if(!o)return;let s=n.querySelector(`.btn-sync-single-track`);s&&s.addEventListener(`click`,e=>{e.stopPropagation(),e.preventDefault(),this.syncSingleTrack(o,n)}),n.addEventListener(`touchstart`,e=>{e.target.closest(`.track-sync-actions`)||(i=!1,r=setTimeout(()=>{i=!0,navigator.vibrate&&navigator.vibrate(35),this.showTrackMenu(o)},500))},{passive:!0}),n.addEventListener(`touchend`,()=>{clearTimeout(r)}),n.addEventListener(`touchmove`,()=>{clearTimeout(r)}),n.addEventListener(`contextmenu`,e=>{e.target.closest(`.track-sync-actions`)||(e.preventDefault(),this.showTrackMenu(o))}),n.addEventListener(`click`,n=>{if(i){i=!1;return}n.target.closest(`.track-sync-actions`)||(e.set({queue:[...t],originalQueue:[...t],isLibraryQueue:!0,isPlaylistMode:!1}),this.player.loadTrack(o,!0,0))})})}async handleManualSync(t){if(!t||t.disabled)return;let n=t.innerHTML;t.disabled=!0,t.innerHTML=`
      <svg class="spin-loader" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span>Kiểm tra...</span>
    `;try{let r=(await i.tracks.list({limit:1e3})).tracks||[];if(r.length===0){t.innerHTML=`<span>Trống</span>`,setTimeout(()=>{t.innerHTML=n,t.disabled=!1},2e3);return}let a=await h();this.cachedTrackIds=new Set(a);let o=r.filter(e=>!a.has(e.id));if(o.length===0){t.innerHTML=`
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span style="color:#10b981;">Đã đủ</span>
        `,this.updateCachedBadges(),setTimeout(()=>{t.innerHTML=n,t.disabled=!1},2500);return}let s=0;for(let n=0;n<o.length;n++){let r=o[n];this.syncingTrackIds.add(r.id),this.syncProgressMap.set(r.id,{percent:0,loadedMb:`0.0`,totalMb:`0.0`});let i=document.querySelector(`.track-item[data-id="${r.id}"]`);if(i){let e=i.querySelector(`.track-sync-actions`);e&&(e.innerHTML=`
              <div class="track-sync-progress" title="Đang tải về máy...">
                <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span class="track-sync-pct">0%</span>
              </div>
            `)}let a=`sync_${r.id}`,c={id:a,track_id:r.id,title:r.title,status:`downloading`,deviceSaving:!0,deviceProgress:1,deviceLoadedMb:`0.0`,deviceTotalMb:`0.0`,progress:1};e.updateJob(c),window.app?.updateHeaderJobsBadge?.(),t.innerHTML=`
          <svg class="spin-loader" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span>${o.length>1?`${n+1}/${o.length} `:``}0%</span>
        `;let l=t.querySelector(`span`);try{await _(r,``,e=>{this.syncProgressMap.set(r.id,e),this.updateTrackRowSyncProgress(r.id,e),l&&(l.textContent=`${o.length>1?`${n+1}/${o.length} `:``}${e.percent}%`),this._pendingJobUpdates.set(r.id,{syncJob:c,prog:e}),this._scheduleProgressFlush()}),s++,this.cachedTrackIds.add(r.id),this.markTrackRowCached(r.id)}catch(e){console.warn(`Manual sync track error:`,e)}finally{this.syncingTrackIds.delete(r.id),this.syncProgressMap.delete(r.id);let t=(e.get().jobs||[]).filter(e=>e.id!==a);e.setJobs(t),window.app?.updateHeaderJobsBadge?.()}}t.innerHTML=`
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="color:#10b981;">Đã xong</span>
      `,this.updateCachedBadges(),this.player?.showToast(`Đã đồng bộ xong ${s} bài hát về máy`),setTimeout(()=>{t.innerHTML=n,t.disabled=!1},3e3)}catch(e){console.warn(`Sync failed:`,e),t.innerHTML=`<span>Lỗi</span>`,setTimeout(()=>{t.innerHTML=n,t.disabled=!1},2500)}}showTrackMenu(e){let t=document.getElementById(`modal-container`);t.innerHTML=`
      <div class="modal-overlay" id="track-menu-modal">
        <div class="modal-card" style="max-width:340px;width:92%;">
          <div class="modal-header">
            <div class="modal-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(e.title)}</div>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>
          <div class="modal-body" style="padding:14px;display:flex;flex-direction:column;gap:8px;">
            <button class="btn-secondary" id="opt-add-playlist" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              ${o.plus} Thêm vào Playlist
            </button>
            <button class="btn-danger" id="opt-delete" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              ${o.trash} Xóa bài hát
            </button>
          </div>
        </div>
      </div>
    `;let n=document.getElementById(`track-menu-modal`);n.querySelector(`#modal-close`).addEventListener(`click`,()=>{n.remove()}),n.addEventListener(`click`,e=>{e.target===n&&n.remove()}),n.querySelector(`#opt-add-playlist`).addEventListener(`click`,()=>{n.remove(),x({trackIds:[e.id],trackTitle:e.title})}),n.querySelector(`#opt-delete`).addEventListener(`click`,async()=>{if(confirm(`Xóa bài "${e.title}" khỏi máy? Thao tác này không thể hoàn tác.`))try{await i.tracks.delete(e.id),n.remove(),this.player?.showToast(`Đã xóa "${e.title}" khỏi thư viện`),await this.fetchAndRenderTracks()}catch(e){alert(`Lỗi xóa: `+e.message)}})}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}};function C(e,t,n){return(t=ae(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function w(){return w=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},w.apply(null,arguments)}function ne(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function T(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?ne(Object(n),!0).forEach(function(t){C(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):ne(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}function E(e,t){if(e==null)return{};var n,r,i=re(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)===-1&&{}.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}function re(e,t){if(e==null)return{};var n={};for(var r in e)if({}.hasOwnProperty.call(e,r)){if(t.indexOf(r)!==-1)continue;n[r]=e[r]}return n}function ie(e,t){if(typeof e!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(typeof r!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function ae(e){var t=ie(e,`string`);return typeof t==`symbol`?t:t+``}function oe(e){"@babel/helpers - typeof";return oe=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},oe(e)}var se=`1.15.7`;function D(e){if(typeof window<`u`&&window.navigator)return!!navigator.userAgent.match(e)}var O=D(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i),ce=D(/Edge/i),le=D(/firefox/i),ue=D(/safari/i)&&!D(/chrome/i)&&!D(/android/i),de=D(/iP(ad|od|hone)/i),fe=D(/chrome/i)&&D(/android/i),pe={capture:!1,passive:!1};function k(e,t,n){e.addEventListener(t,n,!O&&pe)}function A(e,t,n){e.removeEventListener(t,n,!O&&pe)}function me(e,t){if(t){if(t[0]===`>`&&(t=t.substring(1)),e)try{if(e.matches)return e.matches(t);if(e.msMatchesSelector)return e.msMatchesSelector(t);if(e.webkitMatchesSelector)return e.webkitMatchesSelector(t)}catch{return!1}return!1}}function he(e){return e.host&&e!==document&&e.host.nodeType&&e.host!==e?e.host:e.parentNode}function j(e,t,n,r){if(e){n||=document;do{if(t!=null&&(t[0]===`>`?e.parentNode===n&&me(e,t):me(e,t))||r&&e===n)return e;if(e===n)break}while(e=he(e))}return null}var ge=/\s+/g;function M(e,t,n){e&&t&&(e.classList?e.classList[n?`add`:`remove`](t):e.className=((` `+e.className+` `).replace(ge,` `).replace(` `+t+` `,` `)+(n?` `+t:``)).replace(ge,` `))}function N(e,t,n){var r=e&&e.style;if(r){if(n===void 0)return document.defaultView&&document.defaultView.getComputedStyle?n=document.defaultView.getComputedStyle(e,``):e.currentStyle&&(n=e.currentStyle),t===void 0?n:n[t];!(t in r)&&t.indexOf(`webkit`)===-1&&(t=`-webkit-`+t),r[t]=n+(typeof n==`string`?``:`px`)}}function _e(e,t){var n=``;if(typeof e==`string`)n=e;else do{var r=N(e,`transform`);r&&r!==`none`&&(n=r+` `+n)}while(!t&&(e=e.parentNode));var i=window.DOMMatrix||window.WebKitCSSMatrix||window.CSSMatrix||window.MSCSSMatrix;return i&&new i(n)}function ve(e,t,n){if(e){var r=e.getElementsByTagName(t),i=0,a=r.length;if(n)for(;i<a;i++)n(r[i],i);return r}return[]}function P(){return document.scrollingElement||document.documentElement}function F(e,t,n,r,i){if(e.getBoundingClientRect||e===window){var a,o,s,c,l,u,d;if(e!==window&&e.parentNode&&e!==P()?(a=e.getBoundingClientRect(),o=a.top,s=a.left,c=a.bottom,l=a.right,u=a.height,d=a.width):(o=0,s=0,c=window.innerHeight,l=window.innerWidth,u=window.innerHeight,d=window.innerWidth),(t||n)&&e!==window&&(i||=e.parentNode,!O))do if(i&&i.getBoundingClientRect&&(N(i,`transform`)!==`none`||n&&N(i,`position`)!==`static`)){var f=i.getBoundingClientRect();o-=f.top+parseInt(N(i,`border-top-width`)),s-=f.left+parseInt(N(i,`border-left-width`)),c=o+a.height,l=s+a.width;break}while(i=i.parentNode);if(r&&e!==window){var p=_e(i||e),m=p&&p.a,h=p&&p.d;p&&(o/=h,s/=m,d/=m,u/=h,c=o+u,l=s+d)}return{top:o,left:s,bottom:c,right:l,width:d,height:u}}}function ye(e,t,n){for(var r=L(e,!0),i=F(e)[t];r;){var a=F(r)[n],o=void 0;if(o=n===`top`||n===`left`?i>=a:i<=a,!o)return r;if(r===P())break;r=L(r,!1)}return!1}function be(e,t,n,r){for(var i=0,a=0,o=e.children;a<o.length;){if(o[a].style.display!==`none`&&o[a]!==Q.ghost&&(r||o[a]!==Q.dragged)&&j(o[a],n.draggable,e,!1)){if(i===t)return o[a];i++}a++}return null}function xe(e,t){for(var n=e.lastElementChild;n&&(n===Q.ghost||N(n,`display`)===`none`||t&&!me(n,t));)n=n.previousElementSibling;return n||null}function I(e,t){var n=0;if(!e||!e.parentNode)return-1;for(;e=e.previousElementSibling;)e.nodeName.toUpperCase()!==`TEMPLATE`&&e!==Q.clone&&(!t||me(e,t))&&n++;return n}function Se(e){var t=0,n=0,r=P();if(e)do{var i=_e(e),a=i.a,o=i.d;t+=e.scrollLeft*a,n+=e.scrollTop*o}while(e!==r&&(e=e.parentNode));return[t,n]}function Ce(e,t){for(var n in e)if(e.hasOwnProperty(n)){for(var r in t)if(t.hasOwnProperty(r)&&t[r]===e[n][r])return Number(n)}return-1}function L(e,t){if(!e||!e.getBoundingClientRect)return P();var n=e,r=!1;do if(n.clientWidth<n.scrollWidth||n.clientHeight<n.scrollHeight){var i=N(n);if(n.clientWidth<n.scrollWidth&&(i.overflowX==`auto`||i.overflowX==`scroll`)||n.clientHeight<n.scrollHeight&&(i.overflowY==`auto`||i.overflowY==`scroll`)){if(!n.getBoundingClientRect||n===document.body)return P();if(r||t)return n;r=!0}}while(n=n.parentNode);return P()}function we(e,t){if(e&&t)for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);return e}function Te(e,t){return Math.round(e.top)===Math.round(t.top)&&Math.round(e.left)===Math.round(t.left)&&Math.round(e.height)===Math.round(t.height)&&Math.round(e.width)===Math.round(t.width)}var Ee;function De(e,t){return function(){if(!Ee){var n=arguments,r=this;n.length===1?e.call(r,n[0]):e.apply(r,n),Ee=setTimeout(function(){Ee=void 0},t)}}}function Oe(){clearTimeout(Ee),Ee=void 0}function ke(e,t,n){e.scrollLeft+=t,e.scrollTop+=n}function Ae(e){var t=window.Polymer,n=window.jQuery||window.Zepto;return t&&t.dom?t.dom(e).cloneNode(!0):n?n(e).clone(!0)[0]:e.cloneNode(!0)}function je(e,t,n){var r={};return Array.from(e.children).forEach(function(i){if(j(i,t.draggable,e,!1)&&!i.animated&&i!==n){var a=F(i);r.left=Math.min(r.left??1/0,a.left),r.top=Math.min(r.top??1/0,a.top),r.right=Math.max(r.right??-1/0,a.right),r.bottom=Math.max(r.bottom??-1/0,a.bottom)}}),r.width=r.right-r.left,r.height=r.bottom-r.top,r.x=r.left,r.y=r.top,r}var R=`Sortable`+new Date().getTime();function Me(){var e=[],t;return{captureAnimationState:function(){e=[],this.options.animation&&[].slice.call(this.el.children).forEach(function(t){if(N(t,`display`)!==`none`&&t!==Q.ghost){e.push({target:t,rect:F(t)});var n=T({},e[e.length-1].rect);if(t.thisAnimationDuration){var r=_e(t,!0);r&&(n.top-=r.f,n.left-=r.e)}t.fromRect=n}})},addAnimationState:function(t){e.push(t)},removeAnimationState:function(t){e.splice(Ce(e,{target:t}),1)},animateAll:function(n){var r=this;if(!this.options.animation){clearTimeout(t),typeof n==`function`&&n();return}var i=!1,a=0;e.forEach(function(e){var t=0,n=e.target,o=n.fromRect,s=F(n),c=n.prevFromRect,l=n.prevToRect,u=e.rect,d=_e(n,!0);d&&(s.top-=d.f,s.left-=d.e),n.toRect=s,n.thisAnimationDuration&&Te(c,s)&&!Te(o,s)&&(u.top-s.top)/(u.left-s.left)===(o.top-s.top)/(o.left-s.left)&&(t=Pe(u,c,l,r.options)),Te(s,o)||(n.prevFromRect=o,n.prevToRect=s,t||=r.options.animation,r.animate(n,u,s,t)),t&&(i=!0,a=Math.max(a,t),clearTimeout(n.animationResetTimer),n.animationResetTimer=setTimeout(function(){n.animationTime=0,n.prevFromRect=null,n.fromRect=null,n.prevToRect=null,n.thisAnimationDuration=null},t),n.thisAnimationDuration=t)}),clearTimeout(t),i?t=setTimeout(function(){typeof n==`function`&&n()},a):typeof n==`function`&&n(),e=[]},animate:function(e,t,n,r){if(r){N(e,`transition`,``),N(e,`transform`,``);var i=_e(this.el),a=i&&i.a,o=i&&i.d,s=(t.left-n.left)/(a||1),c=(t.top-n.top)/(o||1);e.animatingX=!!s,e.animatingY=!!c,N(e,`transform`,`translate3d(`+s+`px,`+c+`px,0)`),this.forRepaintDummy=Ne(e),N(e,`transition`,`transform `+r+`ms`+(this.options.easing?` `+this.options.easing:``)),N(e,`transform`,`translate3d(0,0,0)`),typeof e.animated==`number`&&clearTimeout(e.animated),e.animated=setTimeout(function(){N(e,`transition`,``),N(e,`transform`,``),e.animated=!1,e.animatingX=!1,e.animatingY=!1},r)}}}}function Ne(e){return e.offsetWidth}function Pe(e,t,n,r){return Math.sqrt((t.top-e.top)**2+(t.left-e.left)**2)/Math.sqrt((t.top-n.top)**2+(t.left-n.left)**2)*r.animation}var Fe=[],Ie={initializeByDefault:!0},Le={mount:function(e){for(var t in Ie)Ie.hasOwnProperty(t)&&!(t in e)&&(e[t]=Ie[t]);Fe.forEach(function(t){if(t.pluginName===e.pluginName)throw`Sortable: Cannot mount plugin ${e.pluginName} more than once`}),Fe.push(e)},pluginEvent:function(e,t,n){var r=this;this.eventCanceled=!1,n.cancel=function(){r.eventCanceled=!0};var i=e+`Global`;Fe.forEach(function(r){t[r.pluginName]&&(t[r.pluginName][i]&&t[r.pluginName][i](T({sortable:t},n)),t.options[r.pluginName]&&t[r.pluginName][e]&&t[r.pluginName][e](T({sortable:t},n)))})},initializePlugins:function(e,t,n,r){for(var i in Fe.forEach(function(r){var i=r.pluginName;if(e.options[i]||r.initializeByDefault){var a=new r(e,t,e.options);a.sortable=e,a.options=e.options,e[i]=a,w(n,a.defaults)}}),e.options)if(e.options.hasOwnProperty(i)){var a=this.modifyOption(e,i,e.options[i]);a!==void 0&&(e.options[i]=a)}},getEventProperties:function(e,t){var n={};return Fe.forEach(function(r){typeof r.eventProperties==`function`&&w(n,r.eventProperties.call(t[r.pluginName],e))}),n},modifyOption:function(e,t,n){var r;return Fe.forEach(function(i){e[i.pluginName]&&i.optionListeners&&typeof i.optionListeners[t]==`function`&&(r=i.optionListeners[t].call(e[i.pluginName],n))}),r}};function Re(e){var t=e.sortable,n=e.rootEl,r=e.name,i=e.targetEl,a=e.cloneEl,o=e.toEl,s=e.fromEl,c=e.oldIndex,l=e.newIndex,u=e.oldDraggableIndex,d=e.newDraggableIndex,f=e.originalEvent,p=e.putSortable,m=e.extraEventProperties;if(t||=n&&n[R],t){var h,g=t.options,_=`on`+r.charAt(0).toUpperCase()+r.substr(1);window.CustomEvent&&!O&&!ce?h=new CustomEvent(r,{bubbles:!0,cancelable:!0}):(h=document.createEvent(`Event`),h.initEvent(r,!0,!0)),h.to=o||n,h.from=s||n,h.item=i||n,h.clone=a,h.oldIndex=c,h.newIndex=l,h.oldDraggableIndex=u,h.newDraggableIndex=d,h.originalEvent=f,h.pullMode=p?p.lastPutMode:void 0;var v=T(T({},m),Le.getEventProperties(r,t));for(var y in v)h[y]=v[y];n&&n.dispatchEvent(h),g[_]&&g[_].call(t,h)}}var ze=[`evt`],z=function(e,t){var n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},r=n.evt,i=E(n,ze);Le.pluginEvent.bind(Q)(e,t,T({dragEl:V,parentEl:H,ghostEl:U,rootEl:W,nextEl:Be,lastDownEl:Ve,cloneEl:G,cloneHidden:K,dragStarted:$e,putSortable:Y,activeSortable:Q.active,originalEvent:r,oldIndex:He,oldDraggableIndex:Ue,newIndex:q,newDraggableIndex:J,hideGhostForTarget:_t,unhideGhostForTarget:vt,cloneNowHidden:function(){K=!0},cloneNowShown:function(){K=!1},dispatchSortableEvent:function(e){B({sortable:t,name:e,originalEvent:r})}},i))};function B(e){Re(T({putSortable:Y,cloneEl:G,targetEl:V,rootEl:W,oldIndex:He,oldDraggableIndex:Ue,newIndex:q,newDraggableIndex:J},e))}var V,H,U,W,Be,Ve,G,K,He,q,Ue,J,We,Y,Ge=!1,Ke=!1,qe=[],Je,X,Ye,Xe,Ze,Qe,$e,et,tt,nt=!1,rt=!1,it,Z,at=[],ot=!1,st=[],ct=typeof document<`u`,lt=de,ut=ce||O?`cssFloat`:`float`,dt=ct&&!fe&&!de&&`draggable`in document.createElement(`div`),ft=function(){if(ct){if(O)return!1;var e=document.createElement(`x`);return e.style.cssText=`pointer-events:auto`,e.style.pointerEvents===`auto`}}(),pt=function(e,t){var n=N(e),r=parseInt(n.width)-parseInt(n.paddingLeft)-parseInt(n.paddingRight)-parseInt(n.borderLeftWidth)-parseInt(n.borderRightWidth),i=be(e,0,t),a=be(e,1,t),o=i&&N(i),s=a&&N(a),c=o&&parseInt(o.marginLeft)+parseInt(o.marginRight)+F(i).width,l=s&&parseInt(s.marginLeft)+parseInt(s.marginRight)+F(a).width;if(n.display===`flex`)return n.flexDirection===`column`||n.flexDirection===`column-reverse`?`vertical`:`horizontal`;if(n.display===`grid`)return n.gridTemplateColumns.split(` `).length<=1?`vertical`:`horizontal`;if(i&&o.float&&o.float!==`none`){var u=o.float===`left`?`left`:`right`;return a&&(s.clear===`both`||s.clear===u)?`vertical`:`horizontal`}return i&&(o.display===`block`||o.display===`flex`||o.display===`table`||o.display===`grid`||c>=r&&n[ut]===`none`||a&&n[ut]===`none`&&c+l>r)?`vertical`:`horizontal`},mt=function(e,t,n){var r=n?e.left:e.top,i=n?e.right:e.bottom,a=n?e.width:e.height,o=n?t.left:t.top,s=n?t.right:t.bottom,c=n?t.width:t.height;return r===o||i===s||r+a/2===o+c/2},ht=function(e,t){var n;return qe.some(function(r){var i=r[R].options.emptyInsertThreshold;if(i&&!xe(r)){var a=F(r),o=e>=a.left-i&&e<=a.right+i,s=t>=a.top-i&&t<=a.bottom+i;if(o&&s)return n=r}}),n},gt=function(e){function t(e,n){return function(r,i,a,o){var s=r.options.group.name&&i.options.group.name&&r.options.group.name===i.options.group.name;if(e==null&&(n||s))return!0;if(e==null||e===!1)return!1;if(n&&e===`clone`)return e;if(typeof e==`function`)return t(e(r,i,a,o),n)(r,i,a,o);var c=(n?r:i).options.group.name;return e===!0||typeof e==`string`&&e===c||e.join&&e.indexOf(c)>-1}}var n={},r=e.group;(!r||oe(r)!=`object`)&&(r={name:r}),n.name=r.name,n.checkPull=t(r.pull,!0),n.checkPut=t(r.put),n.revertClone=r.revertClone,e.group=n},_t=function(){!ft&&U&&N(U,`display`,`none`)},vt=function(){!ft&&U&&N(U,`display`,``)};ct&&!fe&&document.addEventListener(`click`,function(e){if(Ke)return e.preventDefault(),e.stopPropagation&&e.stopPropagation(),e.stopImmediatePropagation&&e.stopImmediatePropagation(),Ke=!1,!1},!0);var yt=function(e){if(V){e=e.touches?e.touches[0]:e;var t=ht(e.clientX,e.clientY);if(t){var n={};for(var r in e)e.hasOwnProperty(r)&&(n[r]=e[r]);n.target=n.rootEl=t,n.preventDefault=void 0,n.stopPropagation=void 0,t[R]._onDragOver(n)}}},bt=function(e){V&&V.parentNode[R]._isOutsideThisEl(e.target)};function Q(e,t){if(!(e&&e.nodeType&&e.nodeType===1))throw`Sortable: \`el\` must be an HTMLElement, not ${{}.toString.call(e)}`;this.el=e,this.options=t=w({},t),e[R]=this;var n={group:null,sort:!0,disabled:!1,store:null,handle:null,draggable:/^[uo]l$/i.test(e.nodeName)?`>li`:`>*`,swapThreshold:1,invertSwap:!1,invertedSwapThreshold:null,removeCloneOnHide:!0,direction:function(){return pt(e,this.options)},ghostClass:`sortable-ghost`,chosenClass:`sortable-chosen`,dragClass:`sortable-drag`,ignore:`a, img`,filter:null,preventOnFilter:!0,animation:0,easing:null,setData:function(e,t){e.setData(`Text`,t.textContent)},dropBubble:!1,dragoverBubble:!1,dataIdAttr:`data-id`,delay:0,delayOnTouchOnly:!1,touchStartThreshold:(Number.parseInt?Number:window).parseInt(window.devicePixelRatio,10)||1,forceFallback:!1,fallbackClass:`sortable-fallback`,fallbackOnBody:!1,fallbackTolerance:0,fallbackOffset:{x:0,y:0},supportPointer:Q.supportPointer!==!1&&`PointerEvent`in window&&(!ue||de),emptyInsertThreshold:5};for(var r in Le.initializePlugins(this,e,n),n)!(r in t)&&(t[r]=n[r]);for(var i in gt(t),this)i.charAt(0)===`_`&&typeof this[i]==`function`&&(this[i]=this[i].bind(this));this.nativeDraggable=!t.forceFallback&&dt,this.nativeDraggable&&(this.options.touchStartThreshold=1),t.supportPointer?k(e,`pointerdown`,this._onTapStart):(k(e,`mousedown`,this._onTapStart),k(e,`touchstart`,this._onTapStart)),this.nativeDraggable&&(k(e,`dragover`,this),k(e,`dragenter`,this)),qe.push(this.el),t.store&&t.store.get&&this.sort(t.store.get(this)||[]),w(this,Me())}Q.prototype={constructor:Q,_isOutsideThisEl:function(e){!this.el.contains(e)&&e!==this.el&&(et=null)},_getDirection:function(e,t){return typeof this.options.direction==`function`?this.options.direction.call(this,e,t,V):this.options.direction},_onTapStart:function(e){if(e.cancelable){var t=this,n=this.el,r=this.options,i=r.preventOnFilter,a=e.type,o=e.touches&&e.touches[0]||e.pointerType&&e.pointerType===`touch`&&e,s=(o||e).target,c=e.target.shadowRoot&&(e.path&&e.path[0]||e.composedPath&&e.composedPath()[0])||s,l=r.filter;if(At(n),!V&&!(/mousedown|pointerdown/.test(a)&&e.button!==0||r.disabled)&&!c.isContentEditable&&!(!this.nativeDraggable&&ue&&s&&s.tagName.toUpperCase()===`SELECT`)&&(s=j(s,r.draggable,n,!1),!(s&&s.animated)&&Ve!==s)){if(He=I(s),Ue=I(s,r.draggable),typeof l==`function`){if(l.call(this,e,s,this)){B({sortable:t,rootEl:c,name:`filter`,targetEl:s,toEl:n,fromEl:n}),z(`filter`,t,{evt:e}),i&&e.preventDefault();return}}else if(l&&(l=l.split(`,`).some(function(r){if(r=j(c,r.trim(),n,!1),r)return B({sortable:t,rootEl:r,name:`filter`,targetEl:s,fromEl:n,toEl:n}),z(`filter`,t,{evt:e}),!0}),l)){i&&e.preventDefault();return}(!r.handle||j(c,r.handle,n,!1))&&this._prepareDragStart(e,o,s)}}},_prepareDragStart:function(e,t,n){var r=this,i=r.el,a=r.options,o=i.ownerDocument,s;if(n&&!V&&n.parentNode===i){var c=F(n);if(W=i,V=n,H=V.parentNode,Be=V.nextSibling,Ve=n,We=a.group,Q.dragged=V,Je={target:V,clientX:(t||e).clientX,clientY:(t||e).clientY},Ze=Je.clientX-c.left,Qe=Je.clientY-c.top,this._lastX=(t||e).clientX,this._lastY=(t||e).clientY,V.style[`will-change`]=`all`,s=function(){if(z(`delayEnded`,r,{evt:e}),Q.eventCanceled){r._onDrop();return}r._disableDelayedDragEvents(),!le&&r.nativeDraggable&&(V.draggable=!0),r._triggerDragStart(e,t),B({sortable:r,name:`choose`,originalEvent:e}),M(V,a.chosenClass,!0)},a.ignore.split(`,`).forEach(function(e){ve(V,e.trim(),Ct)}),k(o,`dragover`,yt),k(o,`mousemove`,yt),k(o,`touchmove`,yt),a.supportPointer?(k(o,`pointerup`,r._onDrop),!this.nativeDraggable&&k(o,`pointercancel`,r._onDrop)):(k(o,`mouseup`,r._onDrop),k(o,`touchend`,r._onDrop),k(o,`touchcancel`,r._onDrop)),le&&this.nativeDraggable&&(this.options.touchStartThreshold=4,V.draggable=!0),z(`delayStart`,this,{evt:e}),a.delay&&(!a.delayOnTouchOnly||t)&&(!this.nativeDraggable||!(ce||O))){if(Q.eventCanceled){this._onDrop();return}a.supportPointer?(k(o,`pointerup`,r._disableDelayedDrag),k(o,`pointercancel`,r._disableDelayedDrag)):(k(o,`mouseup`,r._disableDelayedDrag),k(o,`touchend`,r._disableDelayedDrag),k(o,`touchcancel`,r._disableDelayedDrag)),k(o,`mousemove`,r._delayedDragTouchMoveHandler),k(o,`touchmove`,r._delayedDragTouchMoveHandler),a.supportPointer&&k(o,`pointermove`,r._delayedDragTouchMoveHandler),r._dragStartTimer=setTimeout(s,a.delay)}else s()}},_delayedDragTouchMoveHandler:function(e){var t=e.touches?e.touches[0]:e;Math.max(Math.abs(t.clientX-this._lastX),Math.abs(t.clientY-this._lastY))>=Math.floor(this.options.touchStartThreshold/(this.nativeDraggable&&window.devicePixelRatio||1))&&this._disableDelayedDrag()},_disableDelayedDrag:function(){V&&Ct(V),clearTimeout(this._dragStartTimer),this._disableDelayedDragEvents()},_disableDelayedDragEvents:function(){var e=this.el.ownerDocument;A(e,`mouseup`,this._disableDelayedDrag),A(e,`touchend`,this._disableDelayedDrag),A(e,`touchcancel`,this._disableDelayedDrag),A(e,`pointerup`,this._disableDelayedDrag),A(e,`pointercancel`,this._disableDelayedDrag),A(e,`mousemove`,this._delayedDragTouchMoveHandler),A(e,`touchmove`,this._delayedDragTouchMoveHandler),A(e,`pointermove`,this._delayedDragTouchMoveHandler)},_triggerDragStart:function(e,t){t||=e.pointerType==`touch`&&e,!this.nativeDraggable||t?this.options.supportPointer?k(document,`pointermove`,this._onTouchMove):t?k(document,`touchmove`,this._onTouchMove):k(document,`mousemove`,this._onTouchMove):(k(V,`dragend`,this),k(W,`dragstart`,this._onDragStart));try{document.selection?jt(function(){document.selection.empty()}):window.getSelection().removeAllRanges()}catch{}},_dragStarted:function(e,t){if(Ge=!1,W&&V){z(`dragStarted`,this,{evt:t}),this.nativeDraggable&&k(document,`dragover`,bt);var n=this.options;!e&&M(V,n.dragClass,!1),M(V,n.ghostClass,!0),Q.active=this,e&&this._appendGhost(),B({sortable:this,name:`start`,originalEvent:t})}else this._nulling()},_emulateDragOver:function(){if(X){this._lastX=X.clientX,this._lastY=X.clientY,_t();for(var e=document.elementFromPoint(X.clientX,X.clientY),t=e;e&&e.shadowRoot&&(e=e.shadowRoot.elementFromPoint(X.clientX,X.clientY),e!==t);)t=e;if(V.parentNode[R]._isOutsideThisEl(e),t)do{if(t[R]){var n=void 0;if(n=t[R]._onDragOver({clientX:X.clientX,clientY:X.clientY,target:e,rootEl:t}),n&&!this.options.dragoverBubble)break}e=t}while(t=he(t));vt()}},_onTouchMove:function(e){if(Je){var t=this.options,n=t.fallbackTolerance,r=t.fallbackOffset,i=e.touches?e.touches[0]:e,a=U&&_e(U,!0),o=U&&a&&a.a,s=U&&a&&a.d,c=lt&&Z&&Se(Z),l=(i.clientX-Je.clientX+r.x)/(o||1)+(c?c[0]-at[0]:0)/(o||1),u=(i.clientY-Je.clientY+r.y)/(s||1)+(c?c[1]-at[1]:0)/(s||1);if(!Q.active&&!Ge){if(n&&Math.max(Math.abs(i.clientX-this._lastX),Math.abs(i.clientY-this._lastY))<n)return;this._onDragStart(e,!0)}if(U){a?(a.e+=l-(Ye||0),a.f+=u-(Xe||0)):a={a:1,b:0,c:0,d:1,e:l,f:u};var d=`matrix(${a.a},${a.b},${a.c},${a.d},${a.e},${a.f})`;N(U,`webkitTransform`,d),N(U,`mozTransform`,d),N(U,`msTransform`,d),N(U,`transform`,d),Ye=l,Xe=u,X=i}e.cancelable&&e.preventDefault()}},_appendGhost:function(){if(!U){var e=this.options.fallbackOnBody?document.body:W,t=F(V,!0,lt,!0,e),n=this.options;if(lt){for(Z=e;N(Z,`position`)===`static`&&N(Z,`transform`)===`none`&&Z!==document;)Z=Z.parentNode;Z!==document.body&&Z!==document.documentElement?(Z===document&&(Z=P()),t.top+=Z.scrollTop,t.left+=Z.scrollLeft):Z=P(),at=Se(Z)}U=V.cloneNode(!0),M(U,n.ghostClass,!1),M(U,n.fallbackClass,!0),M(U,n.dragClass,!0),N(U,`transition`,``),N(U,`transform`,``),N(U,`box-sizing`,`border-box`),N(U,`margin`,0),N(U,`top`,t.top),N(U,`left`,t.left),N(U,`width`,t.width),N(U,`height`,t.height),N(U,`opacity`,`0.8`),N(U,`position`,lt?`absolute`:`fixed`),N(U,`zIndex`,`100000`),N(U,`pointerEvents`,`none`),Q.ghost=U,e.appendChild(U),N(U,`transform-origin`,Ze/parseInt(U.style.width)*100+`% `+Qe/parseInt(U.style.height)*100+`%`)}},_onDragStart:function(e,t){var n=this,r=e.dataTransfer,i=n.options;if(z(`dragStart`,this,{evt:e}),Q.eventCanceled){this._onDrop();return}z(`setupClone`,this),Q.eventCanceled||(G=Ae(V),G.removeAttribute(`id`),G.draggable=!1,G.style[`will-change`]=``,this._hideClone(),M(G,this.options.chosenClass,!1),Q.clone=G),n.cloneId=jt(function(){z(`clone`,n),!Q.eventCanceled&&(n.options.removeCloneOnHide||W.insertBefore(G,V),n._hideClone(),B({sortable:n,name:`clone`}))}),!t&&M(V,i.dragClass,!0),t?(Ke=!0,n._loopId=setInterval(n._emulateDragOver,50)):(A(document,`mouseup`,n._onDrop),A(document,`touchend`,n._onDrop),A(document,`touchcancel`,n._onDrop),r&&(r.effectAllowed=`move`,i.setData&&i.setData.call(n,r,V)),k(document,`drop`,n),N(V,`transform`,`translateZ(0)`)),Ge=!0,n._dragStartId=jt(n._dragStarted.bind(n,t,e)),k(document,`selectstart`,n),$e=!0,window.getSelection().removeAllRanges(),ue&&N(document.body,`user-select`,`none`)},_onDragOver:function(e){var t=this.el,n=e.target,r,i,a,o=this.options,s=o.group,c=Q.active,l=We===s,u=o.sort,d=Y||c,f,p=this,m=!1;if(ot)return;function h(o,s){z(o,p,T({evt:e,isOwner:l,axis:f?`vertical`:`horizontal`,revert:a,dragRect:r,targetRect:i,canSort:u,fromSortable:d,target:n,completed:_,onMove:function(n,i){return St(W,t,V,r,n,F(n),e,i)},changed:v},s))}function g(){h(`dragOverAnimationCapture`),p.captureAnimationState(),p!==d&&d.captureAnimationState()}function _(r){return h(`dragOverCompleted`,{insertion:r}),r&&(l?c._hideClone():c._showClone(p),p!==d&&(M(V,Y?Y.options.ghostClass:c.options.ghostClass,!1),M(V,o.ghostClass,!0)),Y!==p&&p!==Q.active?Y=p:p===Q.active&&Y&&(Y=null),d===p&&(p._ignoreWhileAnimating=n),p.animateAll(function(){h(`dragOverAnimationComplete`),p._ignoreWhileAnimating=null}),p!==d&&(d.animateAll(),d._ignoreWhileAnimating=null)),(n===V&&!V.animated||n===t&&!n.animated)&&(et=null),!o.dragoverBubble&&!e.rootEl&&n!==document&&(V.parentNode[R]._isOutsideThisEl(e.target),!r&&yt(e)),!o.dragoverBubble&&e.stopPropagation&&e.stopPropagation(),m=!0}function v(){q=I(V),J=I(V,o.draggable),B({sortable:p,name:`change`,toEl:t,newIndex:q,newDraggableIndex:J,originalEvent:e})}if(e.preventDefault!==void 0&&e.cancelable&&e.preventDefault(),n=j(n,o.draggable,t,!0),h(`dragOver`),Q.eventCanceled)return m;if(V.contains(e.target)||n.animated&&n.animatingX&&n.animatingY||p._ignoreWhileAnimating===n)return _(!1);if(Ke=!1,c&&!o.disabled&&(l?u||(a=H!==W):Y===this||(this.lastPutMode=We.checkPull(this,c,V,e))&&s.checkPut(this,c,V,e))){if(f=this._getDirection(e,n)===`vertical`,r=F(V),h(`dragOverValid`),Q.eventCanceled)return m;if(a)return H=W,g(),this._hideClone(),h(`revert`),Q.eventCanceled||(Be?W.insertBefore(V,Be):W.appendChild(V)),_(!0);var y=xe(t,o.draggable);if(!y||Et(e,f,this)&&!y.animated){if(y===V)return _(!1);if(y&&t===e.target&&(n=y),n&&(i=F(n)),St(W,t,V,r,n,i,e,!!n)!==!1)return g(),y&&y.nextSibling?t.insertBefore(V,y.nextSibling):t.appendChild(V),H=t,v(),_(!0)}else if(y&&Tt(e,f,this)){var b=be(t,0,o,!0);if(b===V)return _(!1);if(n=b,i=F(n),St(W,t,V,r,n,i,e,!1)!==!1)return g(),t.insertBefore(V,b),H=t,v(),_(!0)}else if(n.parentNode===t){i=F(n);var x=0,S,ee=V.parentNode!==t,te=!mt(V.animated&&V.toRect||r,n.animated&&n.toRect||i,f),C=f?`top`:`left`,w=ye(n,`top`,`top`)||ye(V,`top`,`top`),ne=w?w.scrollTop:void 0;et!==n&&(S=i[C],nt=!1,rt=!te&&o.invertSwap||ee),x=Dt(e,n,i,f,te?1:o.swapThreshold,o.invertedSwapThreshold==null?o.swapThreshold:o.invertedSwapThreshold,rt,et===n);var E;if(x!==0){var re=I(V);do re-=x,E=H.children[re];while(E&&(N(E,`display`)===`none`||E===U))}if(x===0||E===n)return _(!1);et=n,tt=x;var ie=n.nextElementSibling,ae=!1;ae=x===1;var oe=St(W,t,V,r,n,i,e,ae);if(oe!==!1)return(oe===1||oe===-1)&&(ae=oe===1),ot=!0,setTimeout(wt,30),g(),ae&&!ie?t.appendChild(V):n.parentNode.insertBefore(V,ae?ie:n),w&&ke(w,0,ne-w.scrollTop),H=V.parentNode,S!==void 0&&!rt&&(it=Math.abs(S-F(n)[C])),v(),_(!0)}if(t.contains(V))return _(!1)}return!1},_ignoreWhileAnimating:null,_offMoveEvents:function(){A(document,`mousemove`,this._onTouchMove),A(document,`touchmove`,this._onTouchMove),A(document,`pointermove`,this._onTouchMove),A(document,`dragover`,yt),A(document,`mousemove`,yt),A(document,`touchmove`,yt)},_offUpEvents:function(){var e=this.el.ownerDocument;A(e,`mouseup`,this._onDrop),A(e,`touchend`,this._onDrop),A(e,`pointerup`,this._onDrop),A(e,`pointercancel`,this._onDrop),A(e,`touchcancel`,this._onDrop),A(document,`selectstart`,this)},_onDrop:function(e){var t=this.el,n=this.options;if(q=I(V),J=I(V,n.draggable),z(`drop`,this,{evt:e}),H=V&&V.parentNode,q=I(V),J=I(V,n.draggable),Q.eventCanceled){this._nulling();return}Ge=!1,rt=!1,nt=!1,clearInterval(this._loopId),clearTimeout(this._dragStartTimer),Mt(this.cloneId),Mt(this._dragStartId),this.nativeDraggable&&(A(document,`drop`,this),A(t,`dragstart`,this._onDragStart)),this._offMoveEvents(),this._offUpEvents(),ue&&N(document.body,`user-select`,``),N(V,`transform`,``),e&&($e&&(e.cancelable&&e.preventDefault(),!n.dropBubble&&e.stopPropagation()),U&&U.parentNode&&U.parentNode.removeChild(U),(W===H||Y&&Y.lastPutMode!==`clone`)&&G&&G.parentNode&&G.parentNode.removeChild(G),V&&(this.nativeDraggable&&A(V,`dragend`,this),Ct(V),V.style[`will-change`]=``,$e&&!Ge&&M(V,Y?Y.options.ghostClass:this.options.ghostClass,!1),M(V,this.options.chosenClass,!1),B({sortable:this,name:`unchoose`,toEl:H,newIndex:null,newDraggableIndex:null,originalEvent:e}),W===H?q!==He&&q>=0&&(B({sortable:this,name:`update`,toEl:H,originalEvent:e}),B({sortable:this,name:`sort`,toEl:H,originalEvent:e})):(q>=0&&(B({rootEl:H,name:`add`,toEl:H,fromEl:W,originalEvent:e}),B({sortable:this,name:`remove`,toEl:H,originalEvent:e}),B({rootEl:H,name:`sort`,toEl:H,fromEl:W,originalEvent:e}),B({sortable:this,name:`sort`,toEl:H,originalEvent:e})),Y&&Y.save()),Q.active&&((q==null||q===-1)&&(q=He,J=Ue),B({sortable:this,name:`end`,toEl:H,originalEvent:e}),this.save()))),this._nulling()},_nulling:function(){z(`nulling`,this),W=V=H=U=Be=G=Ve=K=Je=X=$e=q=J=He=Ue=et=tt=Y=We=Q.dragged=Q.ghost=Q.clone=Q.active=null;var e=this.el;st.forEach(function(t){e.contains(t)&&(t.checked=!0)}),st.length=Ye=Xe=0},handleEvent:function(e){switch(e.type){case`drop`:case`dragend`:this._onDrop(e);break;case`dragenter`:case`dragover`:V&&(this._onDragOver(e),xt(e));break;case`selectstart`:e.preventDefault()}},toArray:function(){for(var e=[],t,n=this.el.children,r=0,i=n.length,a=this.options;r<i;r++)t=n[r],j(t,a.draggable,this.el,!1)&&e.push(t.getAttribute(a.dataIdAttr)||kt(t));return e},sort:function(e,t){var n={},r=this.el;this.toArray().forEach(function(e,t){var i=r.children[t];j(i,this.options.draggable,r,!1)&&(n[e]=i)},this),t&&this.captureAnimationState(),e.forEach(function(e){n[e]&&(r.removeChild(n[e]),r.appendChild(n[e]))}),t&&this.animateAll()},save:function(){var e=this.options.store;e&&e.set&&e.set(this)},closest:function(e,t){return j(e,t||this.options.draggable,this.el,!1)},option:function(e,t){var n=this.options;if(t===void 0)return n[e];var r=Le.modifyOption(this,e,t);n[e]=r===void 0?t:r,e===`group`&&gt(n)},destroy:function(){z(`destroy`,this);var e=this.el;e[R]=null,A(e,`mousedown`,this._onTapStart),A(e,`touchstart`,this._onTapStart),A(e,`pointerdown`,this._onTapStart),this.nativeDraggable&&(A(e,`dragover`,this),A(e,`dragenter`,this)),Array.prototype.forEach.call(e.querySelectorAll(`[draggable]`),function(e){e.removeAttribute(`draggable`)}),this._onDrop(),this._disableDelayedDragEvents(),qe.splice(qe.indexOf(this.el),1),this.el=e=null},_hideClone:function(){if(!K){if(z(`hideClone`,this),Q.eventCanceled)return;N(G,`display`,`none`),this.options.removeCloneOnHide&&G.parentNode&&G.parentNode.removeChild(G),K=!0}},_showClone:function(e){if(e.lastPutMode!==`clone`){this._hideClone();return}if(K){if(z(`showClone`,this),Q.eventCanceled)return;V.parentNode==W&&!this.options.group.revertClone?W.insertBefore(G,V):Be?W.insertBefore(G,Be):W.appendChild(G),this.options.group.revertClone&&this.animate(V,G),N(G,`display`,``),K=!1}}};function xt(e){e.dataTransfer&&(e.dataTransfer.dropEffect=`move`),e.cancelable&&e.preventDefault()}function St(e,t,n,r,i,a,o,s){var c,l=e[R],u=l.options.onMove,d;return window.CustomEvent&&!O&&!ce?c=new CustomEvent(`move`,{bubbles:!0,cancelable:!0}):(c=document.createEvent(`Event`),c.initEvent(`move`,!0,!0)),c.to=t,c.from=e,c.dragged=n,c.draggedRect=r,c.related=i||t,c.relatedRect=a||F(t),c.willInsertAfter=s,c.originalEvent=o,e.dispatchEvent(c),u&&(d=u.call(l,c,o)),d}function Ct(e){e.draggable=!1}function wt(){ot=!1}function Tt(e,t,n){var r=F(be(n.el,0,n.options,!0)),i=je(n.el,n.options,U),a=10;return t?e.clientX<i.left-a||e.clientY<r.top&&e.clientX<r.right:e.clientY<i.top-a||e.clientY<r.bottom&&e.clientX<r.left}function Et(e,t,n){var r=F(xe(n.el,n.options.draggable)),i=je(n.el,n.options,U),a=10;return t?e.clientX>i.right+a||e.clientY>r.bottom&&e.clientX>r.left:e.clientY>i.bottom+a||e.clientX>r.right&&e.clientY>r.top}function Dt(e,t,n,r,i,a,o,s){var c=r?e.clientY:e.clientX,l=r?n.height:n.width,u=r?n.top:n.left,d=r?n.bottom:n.right,f=!1;if(!o){if(s&&it<l*i){if(!nt&&(tt===1?c>u+l*a/2:c<d-l*a/2)&&(nt=!0),nt)f=!0;else if(tt===1?c<u+it:c>d-it)return-tt}else if(c>u+l*(1-i)/2&&c<d-l*(1-i)/2)return Ot(t)}return f||=o,f&&(c<u+l*a/2||c>d-l*a/2)?c>u+l/2?1:-1:0}function Ot(e){return I(V)<I(e)?1:-1}function kt(e){for(var t=e.tagName+e.className+e.src+e.href+e.textContent,n=t.length,r=0;n--;)r+=t.charCodeAt(n);return r.toString(36)}function At(e){st.length=0;for(var t=e.getElementsByTagName(`input`),n=t.length;n--;){var r=t[n];r.checked&&st.push(r)}}function jt(e){return setTimeout(e,0)}function Mt(e){return clearTimeout(e)}ct&&k(document,`touchmove`,function(e){(Q.active||Ge)&&e.cancelable&&e.preventDefault()}),Q.utils={on:k,off:A,css:N,find:ve,is:function(e,t){return!!j(e,t,e,!1)},extend:we,throttle:De,closest:j,toggleClass:M,clone:Ae,index:I,nextTick:jt,cancelNextTick:Mt,detectDirection:pt,getChild:be,expando:R},Q.get=function(e){return e[R]},Q.mount=function(){var e=[...arguments];e[0].constructor===Array&&(e=e[0]),e.forEach(function(e){if(!e.prototype||!e.prototype.constructor)throw`Sortable: Mounted plugin must be a constructor function, not ${{}.toString.call(e)}`;e.utils&&(Q.utils=T(T({},Q.utils),e.utils)),Le.mount(e)})},Q.create=function(e,t){return new Q(e,t)},Q.version=se;var $=[],Nt,Pt,Ft=!1,It,Lt,Rt,zt;function Bt(){function e(){for(var e in this.defaults={scroll:!0,forceAutoScrollFallback:!1,scrollSensitivity:30,scrollSpeed:10,bubbleScroll:!0},this)e.charAt(0)===`_`&&typeof this[e]==`function`&&(this[e]=this[e].bind(this))}return e.prototype={dragStarted:function(e){var t=e.originalEvent;this.sortable.nativeDraggable?k(document,`dragover`,this._handleAutoScroll):this.options.supportPointer?k(document,`pointermove`,this._handleFallbackAutoScroll):t.touches?k(document,`touchmove`,this._handleFallbackAutoScroll):k(document,`mousemove`,this._handleFallbackAutoScroll)},dragOverCompleted:function(e){var t=e.originalEvent;!this.options.dragOverBubble&&!t.rootEl&&this._handleAutoScroll(t)},drop:function(){this.sortable.nativeDraggable?A(document,`dragover`,this._handleAutoScroll):(A(document,`pointermove`,this._handleFallbackAutoScroll),A(document,`touchmove`,this._handleFallbackAutoScroll),A(document,`mousemove`,this._handleFallbackAutoScroll)),Ht(),Vt(),Oe()},nulling:function(){Rt=Pt=Nt=Ft=zt=It=Lt=null,$.length=0},_handleFallbackAutoScroll:function(e){this._handleAutoScroll(e,!0)},_handleAutoScroll:function(e,t){var n=this,r=(e.touches?e.touches[0]:e).clientX,i=(e.touches?e.touches[0]:e).clientY,a=document.elementFromPoint(r,i);if(Rt=e,t||this.options.forceAutoScrollFallback||ce||O||ue){Ut(e,this.options,a,t);var o=L(a,!0);Ft&&(!zt||r!==It||i!==Lt)&&(zt&&Ht(),zt=setInterval(function(){var a=L(document.elementFromPoint(r,i),!0);a!==o&&(o=a,Vt()),Ut(e,n.options,a,t)},10),It=r,Lt=i)}else{if(!this.options.bubbleScroll||L(a,!0)===P()){Vt();return}Ut(e,this.options,L(a,!1),!1)}}},w(e,{pluginName:`scroll`,initializeByDefault:!0})}function Vt(){$.forEach(function(e){clearInterval(e.pid)}),$=[]}function Ht(){clearInterval(zt)}var Ut=De(function(e,t,n,r){if(t.scroll){var i=(e.touches?e.touches[0]:e).clientX,a=(e.touches?e.touches[0]:e).clientY,o=t.scrollSensitivity,s=t.scrollSpeed,c=P(),l=!1,u;Pt!==n&&(Pt=n,Vt(),Nt=t.scroll,u=t.scrollFn,Nt===!0&&(Nt=L(n,!0)));var d=0,f=Nt;do{var p=f,m=F(p),h=m.top,g=m.bottom,_=m.left,v=m.right,y=m.width,b=m.height,x=void 0,S=void 0,ee=p.scrollWidth,te=p.scrollHeight,C=N(p),w=p.scrollLeft,ne=p.scrollTop;p===c?(x=y<ee&&(C.overflowX===`auto`||C.overflowX===`scroll`||C.overflowX===`visible`),S=b<te&&(C.overflowY===`auto`||C.overflowY===`scroll`||C.overflowY===`visible`)):(x=y<ee&&(C.overflowX===`auto`||C.overflowX===`scroll`),S=b<te&&(C.overflowY===`auto`||C.overflowY===`scroll`));var T=x&&(Math.abs(v-i)<=o&&w+y<ee)-(Math.abs(_-i)<=o&&!!w),E=S&&(Math.abs(g-a)<=o&&ne+b<te)-(Math.abs(h-a)<=o&&!!ne);if(!$[d])for(var re=0;re<=d;re++)$[re]||($[re]={});($[d].vx!=T||$[d].vy!=E||$[d].el!==p)&&($[d].el=p,$[d].vx=T,$[d].vy=E,clearInterval($[d].pid),(T!=0||E!=0)&&(l=!0,$[d].pid=setInterval(function(){r&&this.layer===0&&Q.active._onTouchMove(Rt);var t=$[this.layer].vy?$[this.layer].vy*s:0,n=$[this.layer].vx?$[this.layer].vx*s:0;(typeof u!=`function`||u.call(Q.dragged.parentNode[R],n,t,e,Rt,$[this.layer].el)===`continue`)&&ke($[this.layer].el,n,t)}.bind({layer:d}),24))),d++}while(t.bubbleScroll&&f!==c&&(f=L(f,!1)));Ft=l}},30),Wt=function(e){var t=e.originalEvent,n=e.putSortable,r=e.dragEl,i=e.activeSortable,a=e.dispatchSortableEvent,o=e.hideGhostForTarget,s=e.unhideGhostForTarget;if(t){var c=n||i;o();var l=t.changedTouches&&t.changedTouches.length?t.changedTouches[0]:t,u=document.elementFromPoint(l.clientX,l.clientY);s(),c&&!c.el.contains(u)&&(a(`spill`),this.onSpill({dragEl:r,putSortable:n}))}};function Gt(){}Gt.prototype={startIndex:null,dragStart:function(e){var t=e.oldDraggableIndex;this.startIndex=t},onSpill:function(e){var t=e.dragEl,n=e.putSortable;this.sortable.captureAnimationState(),n&&n.captureAnimationState();var r=be(this.sortable.el,this.startIndex,this.options);r?this.sortable.el.insertBefore(t,r):this.sortable.el.appendChild(t),this.sortable.animateAll(),n&&n.animateAll()},drop:Wt},w(Gt,{pluginName:`revertOnSpill`});function Kt(){}Kt.prototype={onSpill:function(e){var t=e.dragEl,n=e.putSortable||this.sortable;n.captureAnimationState(),t.parentNode&&t.parentNode.removeChild(t),n.animateAll()},drop:Wt},w(Kt,{pluginName:`removeOnSpill`}),Q.mount(new Bt),Q.mount(Kt,Gt);var qt=class{constructor(e){this.player=e,this.container=document.getElementById(`main-view`),this.activePlaylistId=null,this.sortableInstance=null}async render(e=null){e?(this.activePlaylistId=e,await this.renderPlaylistDetail(e)):(this.activePlaylistId=null,await this.renderPlaylistsOverview())}async renderPlaylistsOverview(){this.container.innerHTML=`
      <div class="playlists-overview">
        <div class="playlists-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div>
            <h2 style="font-size:1.35rem;font-weight:700;letter-spacing:-0.01em;margin:0;">Danh sách phát</h2>
          </div>
          <button id="btn-create-playlist" class="btn-primary" style="display:none;min-height:36px;padding:0 14px;border-radius:20px;font-size:0.84rem;font-weight:600;align-items:center;gap:6px;" title="Tạo hoặc nhập playlist">
            ${o.plus} <span>Tạo playlist</span>
          </button>
        </div>

        <div id="playlists-list" class="playlists-grid">
          <div class="empty-state" style="grid-column:1/-1;">Đang tải danh sách phát...</div>
        </div>
      </div>
    `,document.getElementById(`btn-create-playlist`).addEventListener(`click`,()=>{this.showCreatePlaylistModal()}),await this.fetchAndRenderOverview()}async fetchAndRenderOverview(){let t=document.getElementById(`playlists-list`),n=document.getElementById(`btn-create-playlist`);t&&(t.innerHTML=[,,,,].fill(0).map(()=>`
        <div class="skeleton-track-row" style="padding:14px;border-radius:var(--radius-lg);margin-bottom:8px;">
          <div class="skeleton-shimmer skeleton-thumb-square" style="width:52px;height:52px;border-radius:12px;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:55%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:30%;"></div>
          </div>
        </div>
      `).join(``));try{let r=await i.playlists.list();if(e.set({playlists:r}),r.length===0){n&&(n.style.display=`none`),t.innerHTML=`
          <div class="empty-state" style="grid-column:1/-1;padding:40px 16px;text-align:center;">
            <div class="empty-icon" style="margin:0 auto 12px;opacity:0.6;">${o.queue}</div>
            <p class="empty-title" style="font-size:1.05rem;font-weight:600;margin-bottom:6px;">Chưa có danh sách phát nào</p>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">Tạo playlist riêng hoặc dán liên kết để nghe trực tiếp & tải offline.</p>
            <button id="btn-empty-create-pl" class="btn-primary" style="min-height:38px;padding:0 18px;border-radius:20px;font-size:0.86rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              ${o.plus} <span>Tạo playlist</span>
            </button>
          </div>
        `;let e=t.querySelector(`#btn-empty-create-pl`);e&&e.addEventListener(`click`,()=>this.showCreatePlaylistModal());return}n&&(n.style.display=`inline-flex`),t.innerHTML=r.map(e=>`
        <div class="playlist-card" data-id="${e.id}">
          <div class="playlist-thumb-box">
            <img class="playlist-thumb-img" src="/api/playlists/${e.id}/thumb?t=${encodeURIComponent(e.updated_at||``)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="playlist-thumb-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
              ${o.queue}
            </div>
          </div>
          <div class="playlist-card-meta">
            <div class="playlist-card-title">${this.escapeHtml(e.name)}</div>
            <div class="playlist-card-sub">${e.track_count||0} bài hát</div>
          </div>
          <div class="playlist-card-actions">
            <button class="icon-btn pl-opt-btn" data-id="${e.id}" title="Tùy chọn">${o.more}</button>
          </div>
        </div>
      `).join(``),t.querySelectorAll(`.playlist-card`).forEach(e=>{e.addEventListener(`click`,t=>{t.target.closest(`.playlist-card-actions`)||this.render(e.dataset.id)})}),t.querySelectorAll(`.pl-opt-btn`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation();let n=r.find(t=>t.id===e.dataset.id);n&&this.showPlaylistMenu(n)})})}catch(e){t.innerHTML=`<div class="empty-state" style="grid-column:1/-1;">Lỗi: ${e.message}</div>`}}async renderPlaylistDetail(t){this.container.innerHTML=`
      <div class="playlist-detail">
        <div class="playlist-detail-hero">
          <div class="playlist-detail-top-nav">
            <button id="btn-back-playlists" class="icon-btn" title="Quay lại danh sách playlist">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button id="btn-pl-detail-opt" class="icon-btn" title="Tùy chọn playlist">
              ${o.more}
            </button>
          </div>

          <div class="playlist-detail-info-row">
            <div class="playlist-detail-cover" id="pl-detail-cover-btn" title="Bấm để đổi ảnh bìa playlist">
              <img id="pl-detail-cover-img" src="/api/playlists/${t}/thumb?t=${Date.now()}" alt="" class="playlist-detail-cover-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div class="playlist-detail-cover-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
                ${o.queue}
              </div>
              <div class="playlist-cover-edit-badge" title="Đổi ảnh bìa">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <div style="flex:1;min-width:0;">
              <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-primary);font-weight:700;">Danh sách phát</span>
              <h2 id="pl-detail-name" style="font-size:1.45rem;font-weight:700;margin:4px 0;line-height:1.2;word-break:break-word;">Đang tải...</h2>
              <p id="pl-detail-count" style="font-size:0.85rem;color:var(--text-secondary);"></p>
            </div>
          </div>

          <div class="playlist-detail-actions-row" style="display:flex;gap:8px;align-items:center;">
            <button id="btn-play-all-pl" class="btn-primary" style="flex:1;min-height:40px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.88rem;font-weight:600;">
              ${o.play} <span>Phát</span>
            </button>
            <button id="btn-shuffle-pl" class="btn-secondary" style="min-height:40px;padding:0 14px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.86rem;font-weight:600;">
              ${o.shuffle} <span>Xáo trộn</span>
            </button>
            <button id="btn-add-tracks-pl" class="pill-btn" style="min-height:40px;padding:0 14px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.86rem;font-weight:500;">
              ${o.plus} <span>Thêm bài</span>
            </button>
          </div>
        </div>

        <div id="playlist-tracks-list" class="track-list">
          ${[,,,,,].fill(0).map(()=>`
            <div class="skeleton-track-row">
              <div class="skeleton-shimmer skeleton-thumb-square"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                <div class="skeleton-shimmer skeleton-text-lg" style="width:65%;"></div>
                <div class="skeleton-shimmer skeleton-text-sm" style="width:35%;"></div>
              </div>
            </div>
          `).join(``)}
        </div>
      </div>
    `,document.getElementById(`btn-back-playlists`).addEventListener(`click`,()=>{this.render()});try{let n=await i.playlists.get(t);document.getElementById(`pl-detail-name`).textContent=n.name,document.getElementById(`pl-detail-count`).textContent=`${(n.tracks||[]).length} bài hát • Kéo để đổi thứ tự`;let r=document.getElementById(`btn-pl-detail-opt`);r&&r.addEventListener(`click`,()=>{this.showPlaylistMenu(n)});let a=document.getElementById(`pl-detail-cover-btn`);a&&a.addEventListener(`click`,()=>{this.showAvatarModal(n)});let o=document.getElementById(`playlist-tracks-list`),s=n.tracks||[];document.getElementById(`btn-add-tracks-pl`).addEventListener(`click`,()=>{S({playlistId:t,playlistName:n.name,currentTrackIds:s.map(e=>e.id),onSuccess:()=>this.renderPlaylistDetail(t)})}),document.getElementById(`btn-play-all-pl`).addEventListener(`click`,()=>{s.length>0&&(e.set({queue:[...s],originalQueue:[...s],isPlaylistMode:!0,isShuffle:!1}),this.player.shuffleBtn&&this.player.shuffleBtn.classList.remove(`active`),this.player.loadTrack(s[0],!0,0,!0))}),document.getElementById(`btn-shuffle-pl`).addEventListener(`click`,()=>{if(s.length>0){let r=[...s],i=[...s];for(let e=i.length-1;e>0;e--){let t=Math.floor(Math.random()*(e+1));[i[e],i[t]]=[i[t],i[e]]}e.set({isShuffle:!0,queue:i,originalQueue:r,isPlaylistMode:!0}),this.player.shuffleBtn&&this.player.shuffleBtn.classList.add(`active`),this.player.loadTrack(i[0],!0,0,!0),this.player?.showToast(`Đang xáo trộn playlist "${n.name}"`,1500),this._renderPlaylistTrackList(o,i,s,n,t)}}),this._renderPlaylistTrackList(o,s,s,n,t)}catch(e){document.getElementById(`playlist-tracks-list`).innerHTML=`
        <div class="empty-state">Lỗi tải playlist: ${e.message}</div>
      `}}_renderPlaylistTrackList(t,n,r,a,s){if(n.length===0){t.innerHTML=`
        <div class="empty-state">
          <p class="empty-title">Playlist đang trống</p>
          <p>Bấm nút bên dưới để chọn bài hát từ thư viện vào playlist này.</p>
          <button class="btn-primary" id="btn-empty-add-tracks" style="margin-top:14px;min-height:38px;padding:0 16px;display:inline-flex;align-items:center;gap:6px;">
            ${o.plus} Thêm bài hát từ thư viện
          </button>
        </div>
      `,document.getElementById(`btn-empty-add-tracks`)?.addEventListener(`click`,()=>{S({playlistId:s,playlistName:a.name,currentTrackIds:[],onSuccess:()=>this.renderPlaylistDetail(s)})});return}t.innerHTML=n.map(e=>`
      <div class="track-item" data-id="${e.id}">
        <div class="drag-handle-touch" style="cursor:grab;color:var(--text-muted);padding-right:4px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>

        <div class="track-thumb-wrap">
          <img class="track-thumb" src="/api/tracks/${e.id}/thumb" alt="Cover" loading="lazy">
        </div>

        <div class="track-meta">
          <div class="track-title">${this.escapeHtml(e.title)}</div>
          <div class="track-sub">
            <span>${this.escapeHtml(e.artist||`Nghệ sĩ`)}</span>
            <span>•</span>
            <span>${this.player.formatTime(e.duration_sec||0)}</span>
            ${e.created_at&&this.player.formatRelativeTime?`<span>•</span><span>${this.player.formatRelativeTime(e.created_at)}</span>`:``}
          </div>
        </div>

        <div class="track-actions">
          <button class="icon-btn pl-track-opt-btn" data-id="${e.id}" title="Tùy chọn">
            ${o.more}
          </button>
        </div>
      </div>
    `).join(``),t.querySelectorAll(`.track-item`).forEach(t=>{t.addEventListener(`click`,i=>{if(i.target.closest(`.track-actions`)||i.target.closest(`.drag-handle-touch`))return;let a=n.find(e=>e.id===t.dataset.id);a&&(e.set({queue:[...n],originalQueue:[...r]}),this.player.loadTrack(a,!0,0,!0))})}),t.querySelectorAll(`.pl-track-opt-btn`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation();let r=e.dataset.id,i=n.find(e=>e.id===r);i&&this.showPlaylistTrackMenu(i,a)})}),this.sortableInstance&&this.sortableInstance.destroy(),this.sortableInstance=new Q(t,{handle:`.drag-handle-touch`,animation:200,ghostClass:`sortable-ghost`,onEnd:async()=>{let e=t.querySelectorAll(`.track-item`),n=Array.from(e).map(e=>e.dataset.id);try{await i.playlists.reorder(s,n)}catch(e){console.error(`Reorder error:`,e)}}})}showCreatePlaylistModal(t=`custom`){let n=document.getElementById(`modal-container`);n.innerHTML=`
      <div class="modal-overlay" id="create-pl-modal">
        <div class="modal-card" style="max-width:460px;width:94%;">
          <div class="modal-header">
            <h3 class="modal-title">Tạo danh sách phát</h3>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>
          <div class="modal-body" style="padding:14px 16px;">
            <!-- Segmented control: Tạo mới | Từ liên kết -->
            <div style="display:flex;gap:6px;background:var(--surface-variant);padding:4px;border-radius:var(--radius-md);margin-bottom:16px;">
              <button id="pl-tab-custom" class="pill-btn active" style="flex:1;text-align:center;min-height:34px;font-size:0.86rem;font-weight:600;border-radius:var(--radius-sm);background:var(--bg-elevated);color:var(--text-primary);box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                Tạo mới
              </button>
              <button id="pl-tab-yt" class="pill-btn" style="flex:1;text-align:center;min-height:34px;font-size:0.86rem;font-weight:600;border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--text-secondary);background:transparent;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Từ liên kết
              </button>
            </div>

            <!-- Tab 1: Tạo playlist mới -->
            <div id="pl-panel-custom">
              <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label">Tên danh sách</label>
                <input type="text" id="pl-name-input" class="form-input" placeholder="Ví dụ: Nhạc chill, Yêu thích..." autofocus>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button class="pill-btn" id="modal-cancel">Hủy</button>
                <button class="btn-primary" id="modal-submit" style="min-height:38px;padding:0 18px;border-radius:20px;font-weight:600;">Tạo playlist</button>
              </div>
            </div>

            <!-- Tab 2: Nhập từ liên kết -->
            <div id="pl-panel-yt" style="display:none;">
              <p style="font-size:0.84rem;color:var(--text-muted);margin:0 0 10px;">
                Dán liên kết danh sách phát hoặc video để nghe trực tuyến hoặc tải về máy.
              </p>
              <div class="form-group" style="display:flex;gap:8px;margin-bottom:12px;">
                <input type="text" id="yt-playlist-url-input" class="form-input" style="flex:1;" placeholder="https://...">
                <button class="btn-primary" id="btn-fetch-yt-pl" style="white-space:nowrap;min-height:38px;padding:0 14px;border-radius:18px;">
                  Đọc link
                </button>
              </div>

              <div id="yt-playlist-loading" style="display:none;text-align:center;padding:16px 0;color:var(--text-secondary);font-size:0.86rem;">
                <div class="skeleton-shimmer" style="width:36px;height:36px;border-radius:50%;margin:0 auto 8px;"></div>
                Đang đọc danh sách phát...
              </div>

              <div id="yt-playlist-error" style="display:none;color:var(--danger, #ef4444);font-size:0.84rem;margin-bottom:10px;"></div>

              <div id="yt-playlist-preview" style="display:none;">
                <div style="padding:10px 12px;background:var(--surface-variant);border-radius:var(--radius-md);margin-bottom:10px;">
                  <div id="yt-pl-title" style="font-weight:700;font-size:0.92rem;color:var(--text-primary);margin-bottom:2px;"></div>
                  <div id="yt-pl-meta" style="font-size:0.8rem;color:var(--text-muted);"></div>
                </div>

                <div id="yt-pl-tracklist" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:12px;padding-right:4px;"></div>

                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                  <button class="btn-secondary" id="btn-stream-yt-pl" style="min-height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;">
                    ${o.play} Nghe online
                  </button>
                  <button class="btn-primary" id="btn-download-yt-pl" style="min-height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Lưu về offline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;let r=document.getElementById(`create-pl-modal`);r.querySelector(`#modal-close`).addEventListener(`click`,()=>r.remove()),r.querySelector(`#modal-cancel`)?.addEventListener(`click`,()=>r.remove()),r.addEventListener(`click`,e=>{e.target===r&&r.remove()});let a=r.querySelector(`#pl-tab-custom`),c=r.querySelector(`#pl-tab-yt`),l=r.querySelector(`#pl-panel-custom`),u=r.querySelector(`#pl-panel-yt`),d=e=>{e===`custom`?(a.style.background=`var(--bg-elevated)`,a.style.color=`var(--text-primary)`,a.style.boxShadow=`0 1px 3px rgba(0,0,0,0.2)`,c.style.background=`transparent`,c.style.color=`var(--text-secondary)`,c.style.boxShadow=`none`,l.style.display=`block`,u.style.display=`none`,r.querySelector(`#pl-name-input`)?.focus()):(c.style.background=`var(--bg-elevated)`,c.style.color=`var(--text-primary)`,c.style.boxShadow=`0 1px 3px rgba(0,0,0,0.2)`,a.style.background=`transparent`,a.style.color=`var(--text-secondary)`,a.style.boxShadow=`none`,l.style.display=`none`,u.style.display=`block`,r.querySelector(`#yt-playlist-url-input`)?.focus())};a.addEventListener(`click`,()=>d(`custom`)),c.addEventListener(`click`,()=>d(`yt`)),t===`yt`&&d(`yt`),r.querySelector(`#modal-submit`).addEventListener(`click`,async()=>{let e=document.getElementById(`pl-name-input`).value.trim();if(!e)return alert(`Vui lòng nhập tên danh sách`);try{let t=await i.playlists.create(e);r.remove(),await this.render(t.id)}catch(e){alert(`Lỗi tạo playlist: `+e.message)}}),r.querySelector(`#pl-name-input`)?.addEventListener(`keydown`,e=>{e.key===`Enter`&&r.querySelector(`#modal-submit`).click()});let f=r.querySelector(`#yt-playlist-url-input`),p=r.querySelector(`#btn-fetch-yt-pl`),m=r.querySelector(`#yt-playlist-preview`),h=r.querySelector(`#yt-playlist-loading`),g=r.querySelector(`#yt-playlist-error`),_=null,v=async()=>{let e=f.value.trim();if(e){g.style.display=`none`,m.style.display=`none`,h.style.display=`block`,p.disabled=!0;try{let t=await i.youtube.info(e);h.style.display=`none`,p.disabled=!1;let n=t.items||(t.isPlaylist?[]:[t]);if(!n||n.length===0)throw Error(`Không tìm thấy bài hát nào trong playlist này`);_={title:t.title||`Danh sách phát`,channel:t.channel||``,items:n},r.querySelector(`#yt-pl-title`).textContent=_.title,r.querySelector(`#yt-pl-meta`).textContent=`${_.channel?_.channel+` • `:``}${n.length} bài hát`;let a=r.querySelector(`#yt-pl-tracklist`);a.innerHTML=n.map((e,t)=>`
          <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border-color);">
            <span style="color:var(--text-muted);min-width:20px;">${t+1}</span>
            <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <span style="font-weight:500;color:var(--text-primary);">${this.escapeHtml(e.title)}</span>
              <span style="color:var(--text-muted);margin-left:6px;">${this.escapeHtml(e.channel||``)}</span>
            </div>
          </div>
        `).join(``),m.style.display=`block`}catch(e){h.style.display=`none`,p.disabled=!1,g.textContent=`Lỗi: `+(e.message||`Không thể đọc playlist này`),g.style.display=`block`}}};p.addEventListener(`click`,v),f.addEventListener(`keydown`,e=>{e.key===`Enter`&&v()}),r.querySelector(`#btn-stream-yt-pl`).addEventListener(`click`,()=>{if(!_||!_.items.length)return;let t=_.items.map(e=>({id:`yt_${e.id}_audio`,youtubeId:e.id,title:e.title,artist:e.channel||`Nghệ sĩ`,album:_.title||`Danh sách phát`,duration_sec:e.duration||0,media_type:`audio`,isOnline:!0,thumbnail_url:e.thumbnail}));e.set({queue:t,originalQueue:t,isPlaylistMode:!1}),this.player.loadOnlineTrack(t[0],!0),r.remove(),this.player?.showToast(`Đang phát online playlist "${_.title}" (${t.length} bài)`)}),r.querySelector(`#btn-download-yt-pl`).addEventListener(`click`,async()=>{if(!_||!_.items.length)return;let e=r.querySelector(`#btn-download-yt-pl`);s(e,{thumbnail:_.thumbnail}),e.disabled=!0,e.textContent=`Đang bắt đầu tải...`;try{await i.youtube.download({items:_.items,createPlaylist:!0,playlistName:_.title||`Danh sách phát`,mediaType:`audio`,quality:`720p`}),r.remove(),this.player?.showToast(`Đã thêm ${_.items.length} bài hát vào hàng đợi tải offline cho playlist "${_.title}"!`,4e3),await this.renderPlaylistsOverview()}catch(t){e.disabled=!1,e.textContent=`Lưu về offline`,alert(`Lỗi tải playlist: `+t.message)}})}showPlaylistMenu(e){let t=document.getElementById(`modal-container`);t.innerHTML=`
      <div class="modal-overlay" id="pl-menu-modal">
        <div class="modal-card" style="max-width:320px;">
          <div class="modal-header">
            <h3 class="modal-title">${this.escapeHtml(e.name)}</h3>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn-secondary" id="pl-opt-avatar" style="justify-content:flex-start;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Đổi ảnh đại diện</span>
            </button>
            <button class="btn-secondary" id="pl-opt-rename" style="justify-content:flex-start;">
              ${o.edit} Đổi tên playlist
            </button>
            <button class="btn-danger" id="pl-opt-delete" style="justify-content:flex-start;">
              ${o.trash} Xóa playlist
            </button>
          </div>
        </div>
      </div>
    `;let n=document.getElementById(`pl-menu-modal`);n.querySelector(`#modal-close`).addEventListener(`click`,()=>n.remove()),n.addEventListener(`click`,e=>{e.target===n&&n.remove()}),n.querySelector(`#pl-opt-avatar`)?.addEventListener(`click`,()=>{n.remove(),this.showAvatarModal(e)}),n.querySelector(`#pl-opt-rename`).addEventListener(`click`,()=>{n.remove();let t=prompt(`Nhập tên mới cho playlist:`,e.name);t&&t.trim()&&t.trim()!==e.name&&i.playlists.rename(e.id,t.trim()).then(()=>this.renderPlaylistsOverview())}),n.querySelector(`#pl-opt-delete`).addEventListener(`click`,async()=>{if(confirm(`Xóa playlist "${e.name}"? Các bài hát trong thư viện vẫn sẽ được giữ lại.`))try{await i.playlists.delete(e.id),n.remove(),await this.renderPlaylistsOverview()}catch(e){alert(`Lỗi xóa playlist: `+e.message)}})}async showAvatarModal(e){let t=e;if(!t.tracks)try{t=await i.playlists.get(e.id)}catch{}let n=document.getElementById(`modal-container`),r=e.id,a=`/api/playlists/${r}/thumb?t=${Date.now()}`;n.innerHTML=`
      <div class="modal-overlay" id="pl-avatar-modal">
        <div class="modal-card" style="max-width:340px;width:90%;">
          <div class="modal-header">
            <h3 class="modal-title">Ảnh bìa Playlist</h3>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;align-items:center;padding:16px;">
            
            <!-- Current Avatar Preview & Click-to-upload -->
            <div class="pl-avatar-preview-wrap" style="width:140px;height:140px;border-radius:16px;overflow:hidden;position:relative;background:var(--bg-surface);box-shadow:0 4px 16px rgba(0,0,0,0.3);border:1px solid var(--border-subtle);">
              <img id="pl-avatar-img-preview" src="${a}" alt="Preview" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/api/playlists/${r}/thumb';">
              <label for="pl-avatar-file-input" class="pl-avatar-upload-overlay" title="Bấm để chọn ảnh từ máy">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span style="font-size:0.75rem;margin-top:3px;font-weight:600;">Đổi ảnh</span>
              </label>
              <input type="file" id="pl-avatar-file-input" accept="image/*" style="display:none;">
            </div>

            <!-- Upload file button -->
            <button id="btn-pick-avatar-file" class="btn-primary" style="width:100%;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:0.88rem;border-radius:20px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Chọn ảnh từ thư viện</span>
            </button>

            <!-- Reset to default button -->
            <button id="btn-reset-pl-avatar" class="btn-secondary" style="width:100%;min-height:36px;font-size:0.82rem;justify-content:center;border-radius:20px;color:var(--text-secondary);">
              <span>Dùng ảnh bìa mặc định</span>
            </button>

          </div>
        </div>
      </div>
    `;let s=document.getElementById(`pl-avatar-modal`);s.querySelector(`#modal-close`).addEventListener(`click`,()=>s.remove()),s.addEventListener(`click`,e=>{e.target===s&&s.remove()});let c=s.querySelector(`#pl-avatar-file-input`),l=s.querySelector(`#btn-pick-avatar-file`);l.addEventListener(`click`,()=>c.click()),c.addEventListener(`change`,async()=>{let e=c.files?.[0];if(!e)return;let t=new FormData;t.append(`avatar`,e),l.disabled=!0,l.textContent=`Đang tải ảnh lên...`;try{await i.playlists.uploadAvatar(r,t),s.remove(),this.activePlaylistId===r?await this.renderPlaylistDetail(r):await this.renderPlaylistsOverview()}catch(e){alert(`Lỗi tải ảnh lên: `+e.message),l.disabled=!1,l.innerHTML=`
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Chọn ảnh từ thư viện</span>
        `}}),s.querySelector(`#btn-reset-pl-avatar`).addEventListener(`click`,async()=>{try{await i.playlists.setAvatar(r,``),s.remove(),this.activePlaylistId===r?await this.renderPlaylistDetail(r):await this.renderPlaylistsOverview()}catch(e){alert(`Lỗi xóa ảnh: `+e.message)}})}showPlaylistTrackMenu(t,n){let r=document.getElementById(`modal-container`);r.innerHTML=`
      <div class="modal-overlay" id="pl-track-menu-modal">
        <div class="modal-card" style="max-width:360px;">
          <div class="modal-header">
            <div class="modal-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(t.title)}</div>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>
          <div class="modal-body" style="padding:12px;display:flex;flex-direction:column;gap:6px;">
            <button class="btn-secondary" id="opt-play-next" style="justify-content:flex-start;">
              ${o.play} Phát tiếp theo
            </button>
            <button class="btn-secondary" id="opt-add-another-playlist" style="justify-content:flex-start;">
              ${o.plus} Thêm vào Playlist khác
            </button>
            <button class="btn-danger" id="opt-remove-pl-track" style="justify-content:flex-start;">
              ${o.trash} Xóa khỏi playlist này
            </button>
          </div>
        </div>
      </div>
    `;let a=document.getElementById(`pl-track-menu-modal`);a.querySelector(`#modal-close`).addEventListener(`click`,()=>a.remove()),a.addEventListener(`click`,e=>{e.target===a&&a.remove()}),a.querySelector(`#opt-play-next`).addEventListener(`click`,()=>{let{queue:n,currentTrack:r}=e.get(),i=n.findIndex(e=>e.id===r?.id),o=[...n.filter(e=>e.id!==t.id)];o.splice(i+1,0,t),e.set({queue:o}),a.remove()}),a.querySelector(`#opt-add-another-playlist`).addEventListener(`click`,()=>{a.remove(),x({trackIds:[t.id],trackTitle:t.title})}),a.querySelector(`#opt-remove-pl-track`).addEventListener(`click`,async()=>{a.remove();try{await i.playlists.removeTrack(n.id,t.id),await this.renderPlaylistDetail(n.id)}catch(e){alert(`Lỗi: `+e.message)}})}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}},Jt=class{constructor(){this.container=document.getElementById(`main-view`),this.unsubscribeJobs=null}async render(){this.unsubscribeJobs&&=(this.unsubscribeJobs(),null),this.container.innerHTML=`
      <div class="settings-view" style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding-bottom:calc(var(--nav-height) + var(--mini-player-height) + var(--safe-bottom) + 16px);">
        <h2 style="font-size:1.3rem;font-weight:700;">Cài đặt cá nhân & hệ thống</h2>

        <!-- Google OAuth Credentials Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <h3 style="font-size:1rem;font-weight:600;margin:0;">Đăng nhập Google (OAuth 2.0)</h3>
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0;line-height:1.4;">
            Cấu hình Client ID và Secret từ <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:var(--accent-primary);text-decoration:underline;">Google Cloud Console</a> để cho phép người dùng đăng nhập tài khoản Google.
          </p>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Google Client ID</label>
            <input type="text" id="setting-google-client-id" class="form-input" placeholder="Ví dụ: 123456789-xxxx.apps.googleusercontent.com">
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Google Client Secret</label>
            <input type="password" id="setting-google-client-secret" class="form-input" placeholder="Ví dụ: GOCSPX-xxxx...">
          </div>

          <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.4;background:var(--bg-elevated);padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
            <strong>Authorized redirect URI cần thêm vào Google Console:</strong><br>
            <code id="google-redirect-uri-display" style="color:var(--accent-primary);font-family:monospace;word-break:break-all;"></code>
          </div>
        </div>

        <!-- Tác vụ tải & chuyển đổi Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h3 style="font-size:1rem;font-weight:600;margin:0;display:flex;align-items:center;gap:6px;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Tác vụ tải & chuyển đổi
              </h3>
              <span id="settings-jobs-count-badge" class="badge" style="position:static;font-size:0.75rem;">0</span>
            </div>
            <button class="pill-btn" id="btn-settings-clear-jobs" style="font-size:0.75rem;padding:4px 10px;">Xóa đã xong</button>
          </div>

          <div id="settings-jobs-list" style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;padding-right:2px;">
            <div class="empty-state" style="padding:16px;">
              <p style="color:var(--text-muted);font-size:0.85rem;">Đang tải danh sách tác vụ...</p>
            </div>
          </div>
        </div>

        <!-- Storage Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:12px;">Dung lượng lưu trữ</h3>
          <div id="storage-stats-content">
            <p style="color:var(--text-muted);font-size:0.85rem;">Đang kiểm tra dung lượng...</p>
          </div>
        </div>

        <!-- Media & Conversion Policies -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:16px;">
          <h3 style="font-size:1rem;font-weight:600;">Tùy chọn đa phương tiện</h3>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Xử lý định dạng lạ (mkv, webm, avi, flac...)</label>
            <select id="setting-policy" class="form-select">
              <option value="convert">Tự động chuyển đổi sang chuẩn iOS (Khuyên dùng)</option>
              <option value="reject">Từ chối và báo lỗi</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Bước tua nhanh / lùi (giây)</label>
            <select id="setting-seek-step" class="form-select">
              <option value="5">5 giây</option>
              <option value="10">10 giây (Mặc định)</option>
              <option value="15">15 giây</option>
              <option value="30">30 giây</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Số tác vụ tải/chuyển đổi đồng thời</label>
            <select id="setting-concurrent-jobs" class="form-select">
              <option value="1">1 tác vụ (Thích hợp cho máy yếu / Pi)</option>
              <option value="2">2 tác vụ (Mặc định)</option>
              <option value="3">3 tác vụ</option>
            </select>
          </div>

          <button id="btn-save-settings" class="btn-primary" style="align-self:flex-end;">Lưu cài đặt</button>
        </div>


        <!-- YouTube Downloader Binary Tools -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:8px;">Bộ công cụ tải trực tuyến</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
            Khi dịch vụ trực tuyến nâng cấp làm quá trình tải bị lỗi, bạn có thể cập nhật bộ công cụ tải bằng nút bên dưới.
          </p>
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="btn-update-ytdlp" class="btn-secondary">Cập nhật yt-dlp</button>
            <span id="ytdlp-status-text" style="font-size:0.85rem;color:var(--text-muted);"></span>
          </div>
        </div>
      </div>
    `,this.bindEvents(),this.bindJobsEvents(),this.updateJobsList(),this.unsubscribeJobs=e.subscribe(()=>{this.updateJobsList()}),await this.loadCurrentSettings(),await this.loadStorage(),await this.loadJobs()}bindJobsEvents(){let t=document.getElementById(`btn-settings-clear-jobs`);t&&t.addEventListener(`click`,async()=>{try{await i.jobs.clearCompleted();let t=await i.jobs.list();e.setJobs(t),this.updateJobsList()}catch(e){console.error(e)}})}async loadJobs(){try{let t=await i.jobs.list();e.setJobs(t),this.updateJobsList()}catch(e){console.warn(`Load jobs notice:`,e)}}updateJobsList(){let t=document.getElementById(`settings-jobs-list`),n=document.getElementById(`settings-jobs-count-badge`);if(!t)return;let r=e.get().jobs||[],a=e.get().activeJobsCount||0;if(n&&(n.textContent=a),r.length===0){t.innerHTML=`
        <div class="empty-state" style="padding:20px;text-align:center;">
          <p class="empty-title" style="font-size:0.92rem;margin-bottom:4px;">Không có tác vụ nào</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Các tác vụ tải trực tuyến hoặc chuyển đổi định dạng sẽ hiển thị ở đây.</p>
        </div>
      `;return}t.innerHTML=r.map(e=>{let t=e.status===`downloading`||e.status===`processing`,n=e.status===`queued`,r=e.status===`error`,i=e.status===`done`,a=e.status===`canceled`,s=``;return t?s=`<span style="color:#60a5fa;font-weight:600;">Đang ${e.status===`downloading`?`tải`:`xử lý`} (${Math.round(e.progress||0)}%)</span>`:n?s=`<span style="color:var(--text-muted);">Đang xếp hàng...</span>`:i?s=`<span style="color:#34d399;font-weight:600;display:inline-flex;align-items:center;gap:4px;">${o.check} Hoàn tất</span>`:r?s=`<span style="color:#f87171;font-weight:600;">Lỗi</span>`:a&&(s=`<span style="color:var(--text-muted);">Đã hủy</span>`),`
        <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div style="min-width:0;flex:1;padding-right:8px;">
              <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${e.kind===`youtube`?`Trực tuyến`:`Chuyển đổi`} - ${this.escapeHtml(e.url||e.track_id||`Media`)}
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap;">
                <span>${e.media_type===`video`?`Video (`+(e.quality||`720p`)+`)`:`Audio (m4a)`}</span>
                <span>•</span>
                ${s}
                ${e.speed?`<span>• ${e.speed}</span>`:``}
                ${e.eta?`<span>• ETA: ${e.eta}</span>`:``}
              </div>
            </div>

            <div style="display:flex;gap:6px;flex-shrink:0;">
              ${t||n?`
                <button class="pill-btn setting-job-cancel-btn" data-id="${e.id}" style="min-height:28px;padding:2px 10px;font-size:0.75rem;">Hủy</button>
              `:``}
              ${r?`
                <button class="pill-btn setting-job-retry-btn" data-id="${e.id}" style="min-height:28px;padding:2px 10px;font-size:0.75rem;">Thử lại</button>
              `:``}
            </div>
          </div>

          ${t?`
            <div style="height:4px;background:var(--border-subtle);border-radius:2px;overflow:hidden;margin-top:6px;">
              <div style="height:100%;width:${e.progress||0}%;background:var(--accent-gradient);transition:width 0.2s ease;"></div>
            </div>
          `:``}

          ${r&&e.error?`
            <div style="font-size:0.75rem;color:#f87171;margin-top:6px;background:rgba(244,63,94,0.1);padding:6px 8px;border-radius:4px;word-break:break-word;">
              ${this.escapeHtml(e.error)}
            </div>
          `:``}
        </div>
      `}).join(``),t.querySelectorAll(`.setting-job-cancel-btn`).forEach(e=>{e.addEventListener(`click`,async()=>{try{await i.jobs.cancel(e.dataset.id)}catch(e){console.error(e)}})}),t.querySelectorAll(`.setting-job-retry-btn`).forEach(e=>{e.addEventListener(`click`,async()=>{try{await i.jobs.retry(e.dataset.id)}catch(e){console.error(e)}})})}async loadCurrentSettings(){try{let t=await i.system.settings();t.unknown_format_policy&&(document.getElementById(`setting-policy`).value=t.unknown_format_policy),t.seek_step&&(document.getElementById(`setting-seek-step`).value=t.seek_step,e.set({seekStep:parseInt(t.seek_step,10)})),t.max_concurrent_jobs&&(document.getElementById(`setting-concurrent-jobs`).value=t.max_concurrent_jobs),t.google_client_id&&(document.getElementById(`setting-google-client-id`).value=t.google_client_id),t.google_client_secret&&(document.getElementById(`setting-google-client-secret`).value=t.google_client_secret);let n=document.getElementById(`google-redirect-uri-display`);n&&(n.textContent=`${window.location.origin}/api/auth/google/callback`)}catch(e){console.error(e)}}async loadStorage(){let e=document.getElementById(`storage-stats-content`);try{let t=await i.system.storage();e.innerHTML=`
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9rem;">
          <span>Đã dùng cho Media:</span>
          <strong>${t.mediaFormatted}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
          <span>Tổng dung lượng thư mục data:</span>
          <strong>${t.totalFormatted}</strong>
        </div>
      `}catch(t){e.innerHTML=`<span style="color:#f87171;font-size:0.85rem;">Không thể đọc dung lượng: ${t.message}</span>`}}bindEvents(){let t=document.getElementById(`btn-save-settings`);t.addEventListener(`click`,async()=>{let n=document.getElementById(`setting-policy`).value,r=document.getElementById(`setting-seek-step`).value,a=document.getElementById(`setting-concurrent-jobs`).value,o=document.getElementById(`setting-google-client-id`)?.value.trim()||``,s=document.getElementById(`setting-google-client-secret`)?.value.trim()||``;try{t.disabled=!0,t.textContent=`Đang lưu...`,await i.system.updateSettings({unknown_format_policy:n,seek_step:r,max_concurrent_jobs:a,google_client_id:o,google_client_secret:s}),e.set({seekStep:parseInt(r,10)}),t.disabled=!1,t.textContent=`Lưu cài đặt`,alert(`Đã cập nhật cài đặt thành công!`)}catch(e){t.disabled=!1,t.textContent=`Lưu cài đặt`,alert(`Lỗi: `+e.message)}});let n=document.getElementById(`btn-update-ytdlp`),r=document.getElementById(`ytdlp-status-text`);n.addEventListener(`click`,async()=>{try{n.disabled=!0,r.textContent=`Đang cập nhật...`;let e=await i.system.updateYtDlp();r.textContent=e.message||`Đã hoàn tất`}catch(e){r.textContent=`Lỗi: `+e.message}finally{n.disabled=!1}})}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}},Yt=class{constructor(e){this.onSuccess=e,this.container=document.getElementById(`modal-container`),this.activeTab=`upload`,this.currentXhr=null,this.ytPrefetchedInfo=null}show(){this.render()}render(){this.container.innerHTML=`
      <div class="modal-overlay" id="add-media-overlay">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <div style="display:flex;gap:8px;">
              <button class="pill-btn ${this.activeTab===`upload`?`active`:``}" id="tab-upload">
                Tải lên từ máy
              </button>
              <button class="pill-btn ${this.activeTab===`youtube`?`active`:``}" id="tab-youtube">
                Tải từ liên kết
              </button>
            </div>
            <button class="icon-btn" id="modal-close">${o.x}</button>
          </div>

          <div class="modal-body" id="add-media-body">
            ${this.activeTab===`upload`?this.renderUploadTab():this.renderYouTubeTab()}
          </div>
        </div>
      </div>
    `;let e=document.getElementById(`add-media-overlay`);e.querySelector(`#modal-close`).addEventListener(`click`,()=>e.remove()),e.querySelector(`#tab-upload`).addEventListener(`click`,()=>{this.activeTab=`upload`,this.render()}),e.querySelector(`#tab-youtube`).addEventListener(`click`,()=>{this.activeTab=`youtube`,this.render()}),this.activeTab===`upload`?this.bindUploadEvents():this.bindYouTubeEvents()}renderUploadTab(){return`
      <div class="upload-zone">
        <div id="drop-area" style="border:2px dashed var(--border-subtle);border-radius:var(--radius-lg);padding:32px 16px;text-align:center;cursor:pointer;background:var(--bg-surface);transition:all 0.2s ease;">
          <div style="color:var(--accent-primary);margin-bottom:12px;">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style="font-weight:600;font-size:1rem;margin-bottom:6px;">Chạm hoặc kéo thả file vào đây</p>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Hỗ trợ Audio (.mp3, .m4a, .aac, .flac, .wav...) & Video (.mp4, .mov, .mkv, .webm...). 
            Định dạng lạ sẽ tự chuyển đổi sang chuẩn iOS.
          </p>
          <input type="file" id="file-input" multiple accept="audio/*,video/*,.mkv,.webm,.flac,.ogg,.opus,.wma" style="display:none;">
        </div>

        <div id="selected-files-list" style="margin-top:16px;max-height:180px;overflow-y:auto;display:none;flex-direction:column;gap:6px;"></div>

        <!-- Progress Bar -->
        <div id="upload-progress-box" style="margin-top:16px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span id="upload-status-text">Đang tải lên...</span>
            <span id="upload-percent-text">0%</span>
          </div>
          <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
            <div id="upload-bar-fill" style="height:100%;width:0%;background:var(--accent-gradient);transition:width 0.15s ease;"></div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px;">
          <button class="pill-btn" id="btn-cancel-upload" style="display:none;">Hủy tải</button>
          <button class="btn-primary" id="btn-start-upload" disabled>Tải lên</button>
        </div>
      </div>
    `}bindUploadEvents(){let e=document.getElementById(`drop-area`),t=document.getElementById(`file-input`),n=document.getElementById(`selected-files-list`),r=document.getElementById(`btn-start-upload`),a=document.getElementById(`btn-cancel-upload`),o=document.getElementById(`upload-progress-box`),s=document.getElementById(`upload-bar-fill`),c=document.getElementById(`upload-percent-text`),l=document.getElementById(`upload-status-text`),u=[];e.addEventListener(`click`,()=>t.click()),e.addEventListener(`dragover`,t=>{t.preventDefault(),e.style.borderColor=`var(--accent-primary)`}),e.addEventListener(`dragleave`,()=>{e.style.borderColor=`var(--border-subtle)`}),e.addEventListener(`drop`,t=>{t.preventDefault(),e.style.borderColor=`var(--border-subtle)`,t.dataTransfer.files&&d(Array.from(t.dataTransfer.files))}),t.addEventListener(`change`,()=>{t.files&&d(Array.from(t.files))});let d=e=>{if(u=e,e.length===0){n.style.display=`none`,r.disabled=!0;return}n.style.display=`flex`,r.disabled=!1,r.textContent=`Tải lên ${e.length} file`,n.innerHTML=e.map((e,t)=>`
        <div style="display:flex;justify-content:space-between;padding:6px 12px;background:var(--bg-surface);border-radius:var(--radius-sm);font-size:0.85rem;">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">${e.name}</span>
          <span style="color:var(--text-muted);">${(e.size/1048576).toFixed(1)} MB</span>
        </div>
      `).join(``)};r.addEventListener(`click`,async()=>{if(u.length===0)return;let e=new FormData;for(let t of u)e.append(`files`,t);r.disabled=!0,a.style.display=`inline-flex`,o.style.display=`block`;try{l.textContent=`Đang tải lên ${u.length} file...`,await i.tracks.upload(e,e=>{s.style.width=`${e}%`,c.textContent=`${e}%`,e>=100&&(l.textContent=`Đang xử lý & phân loại định dạng...`)}),l.textContent=`Hoàn tất!`,setTimeout(()=>{document.getElementById(`add-media-overlay`).remove(),this.onSuccess&&this.onSuccess()},800)}catch(e){l.textContent=`Lỗi: `+e.message,r.disabled=!1,a.style.display=`none`}})}renderYouTubeTab(){return`
      <div class="youtube-zone">
        <div class="form-group">
          <label class="form-label">Dán liên kết trực tuyến (Video, Danh sách phát, Âm nhạc)</label>
          <div style="display:flex;gap:8px;">
            <input type="url" id="yt-url-input" class="form-input" placeholder="https://..." autofocus>
            <button class="btn-primary" id="btn-yt-check" style="flex-shrink:0;">Kiểm tra</button>
          </div>
        </div>

        <div id="yt-preview-area" style="display:none;margin-top:16px;"></div>

        <div id="yt-options-area" style="display:none;margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:16px;">
          <div id="yt-playlist-extra" style="display:none;">
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="yt-create-playlist-cb" checked>
                <span>Tạo playlist tương ứng trong app</span>
              </label>
            </div>
            <div class="form-group" id="yt-playlist-name-group">
              <label class="form-label">Tên playlist</label>
              <input type="text" id="yt-playlist-name" class="form-input" value="">
            </div>
          </div>

          <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <button class="btn-primary" id="btn-yt-download">Tải audio (m4a)</button>
          </div>
        </div>
      </div>
    `}bindYouTubeEvents(){let e=document.getElementById(`btn-yt-check`),t=document.getElementById(`yt-url-input`),n=document.getElementById(`yt-preview-area`),r=document.getElementById(`yt-options-area`),a=document.getElementById(`yt-playlist-extra`),o=document.getElementById(`yt-playlist-name`),c=document.getElementById(`btn-yt-download`);e.addEventListener(`click`,async()=>{let s=t.value.trim();if(!s)return alert(`Vui lòng dán đường link YouTube`);e.disabled=!0,e.textContent=`Đang kiểm tra...`,n.style.display=`block`,n.innerHTML=`<div class="empty-state">Đang lấy thông tin từ YouTube qua yt-dlp...</div>`,r.style.display=`none`;try{let t=await i.youtube.info(s);this.ytPrefetchedInfo=t,e.disabled=!1,e.textContent=`Kiểm tra`,t.isPlaylist?(a.style.display=`block`,o.value=t.title||`YouTube Playlist`,n.innerHTML=`
            <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <h4 style="font-weight:700;margin-bottom:4px;">${t.title}</h4>
              <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">Playlist gồm ${t.count} bài • Kênh: ${t.channel}</p>
              <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                ${(t.items||[]).map((e,t)=>`
                  <div style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${t+1}. ${e.title}
                  </div>
                `).join(``)}
              </div>
            </div>
          `):(a.style.display=`none`,n.innerHTML=`
            <div style="display:flex;gap:12px;background:var(--bg-surface);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <img src="${t.thumbnail}" alt="" style="width:90px;height:60px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;">
              <div style="min-width:0;">
                <h4 style="font-size:0.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</h4>
                <p style="font-size:0.8rem;color:var(--text-muted);">${t.channel} • ${Math.round(t.duration/60)} phút</p>
              </div>
            </div>
          `),r.style.display=`block`}catch(t){e.disabled=!1,e.textContent=`Kiểm tra`,n.innerHTML=`<div class="empty-state" style="color:#fb7185;">Lỗi: ${t.message}</div>`}}),c.addEventListener(`click`,async()=>{if(!this.ytPrefetchedInfo)return;s(c,this.ytPrefetchedInfo);let e=`audio`,n=`720p`,r=t.value.trim();c.disabled=!0,c.textContent=`Đang xếp hàng...`;try{if(this.ytPrefetchedInfo.isPlaylist){let t=document.getElementById(`yt-create-playlist-cb`).checked,a=o.value.trim();await i.youtube.download({url:r,mediaType:e,quality:n,items:this.ytPrefetchedInfo.items,createPlaylist:t,playlistName:a})}else await i.youtube.download({url:r,mediaType:e,quality:n});document.getElementById(`add-media-overlay`).remove(),alert(`Đã thêm tác vụ tải vào hàng đợi! Bạn có thể theo dõi tiến trình ở biểu tượng Tác vụ trên thanh tiêu đề.`),this.onSuccess&&this.onSuccess()}catch(e){c.disabled=!1,c.textContent=`Bắt đầu tải`,alert(`Lỗi tạo tác vụ: `+e.message)}})}},Xt=class{constructor(e,t){this.currentUser=e,this.onUserChanged=t}async show(){document.getElementById(`user-profile-modal`)?.remove();let e=(await i.auth.check().catch(()=>({}))).user||this.currentUser,t=!!e?.isGoogle,n=document.createElement(`div`);n.className=`modal-overlay`,n.id=`user-profile-modal`,n.style.zIndex=`9999`,n.innerHTML=`
      <div class="modal-card" style="max-width:420px;width:95%;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
          <h3 class="modal-title" style="display:flex;align-items:center;gap:8px;font-size:1.05rem;">
            ${t?`Tài khoản Google`:`Đăng nhập`}
          </h3>
          <button class="icon-btn" id="modal-user-close">${o.x}</button>
        </div>

        <div class="modal-body" style="padding:18px 0;display:flex;flex-direction:column;gap:16px;">
          ${t?`
            <!-- Logged in Google User Card -->
            <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;display:flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;background:#4285F4;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2rem;flex-shrink:0;">
                ${e?.avatar?`<img src="${e.avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`:e?.name?.slice(0,1)?.toUpperCase()||`G`}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${this.escapeHtml(e?.name||`Tài khoản Google`)}
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${this.escapeHtml(e?.email||``)}
                </div>
                <div style="margin-top:4px;">
                  <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.15);color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                    ${o.check} Đã liên kết tài khoản
                  </span>
                </div>
              </div>
            </div>
          `:`
            <!-- Not logged in: Google Sign In Option -->
            <div style="text-align:center;padding:10px 0;">
              <div style="width:52px;height:52px;border-radius:50%;background:rgba(66,133,244,0.1);color:#4285F4;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                <svg width="28" height="28" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              </div>
              <h4 style="font-size:1.05rem;font-weight:600;margin:0 0 6px;">Đăng nhập bằng Google</h4>
              <p style="font-size:0.82rem;color:var(--text-muted);margin:0 auto 16px;max-width:320px;line-height:1.4;">
                Đồng bộ tự động Kênh đăng ký, Bài hát đã thích và Danh sách phát cá nhân của bạn.
              </p>

              <button id="btn-modal-google-login" class="pill-btn" style="width:100%;justify-content:center;background:#ffffff;color:#1f2937;font-weight:600;font-size:0.88rem;padding:10px 16px;border:none;box-shadow:0 2px 8px rgba(0,0,0,0.25);gap:8px;cursor:pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Tiếp tục với Google
              </button>
            </div>
          `}
        </div>

        <div class="modal-footer" style="border-top:1px solid var(--border-subtle);padding-top:12px;display:flex;justify-content:${t?`space-between`:`flex-end`};align-items:center;">
          ${t?`
            <button id="btn-modal-logout" class="pill-btn" style="color:#ef4444;border-color:rgba(239,68,68,0.3);font-size:0.8rem;padding:6px 14px;">
              Đăng xuất
            </button>
          `:``}
          <button class="pill-btn" id="modal-user-close-btn" style="font-size:0.85rem;padding:6px 16px;">
            Đóng
          </button>
        </div>
      </div>
    `,document.body.appendChild(n),n.querySelector(`#modal-user-close`).addEventListener(`click`,()=>n.remove()),n.querySelector(`#modal-user-close-btn`).addEventListener(`click`,()=>n.remove()),n.querySelector(`#btn-modal-google-login`)?.addEventListener(`click`,async()=>{try{let e=await i.auth.googleUrl();e.url&&(window.location.href=e.url)}catch(e){alert(e.message||`Không thể tạo đường dẫn đăng nhập Google. Vui lòng kiểm tra Client ID trong Cài đặt.`)}}),n.querySelector(`#btn-modal-logout`)?.addEventListener(`click`,async()=>{if(confirm(`Bạn có chắc muốn đăng xuất khỏi tài khoản Google?`)){try{await i.auth.logout()}catch{}localStorage.removeItem(`muzifi_token`),localStorage.removeItem(`metube_token`),n.remove(),window.location.href=`/`}})}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}},Zt=class{constructor(e){this.player=e,this.container=document.getElementById(`main-view`),this.activeChip=`all`,this.feedItems=null,this.searchItems=null,this.currentQuery=``,this.currentUser=null,this.meData=null,this.page=1,this.isLoadingMore=!1,this.hasMore=!0,this.renderedVideoIds=new Set,this.observer=null,this.allItems=[]}async render(){try{let e=await i.auth.check();this.currentUser=e.user}catch{this.currentUser=null}this.currentUser?.isGoogle,this.container.innerHTML=`
      <div class="online-view">
        <!-- Search Bar (SoundCloud Search with Suggestions) -->
        <div class="search-bar-row ytm-search-row" style="margin-bottom:14px;position:relative;">
          <div class="search-input-box" style="position:relative;">
            ${o.search}
            <input type="text" id="online-search-input" autocomplete="off" spellcheck="false" placeholder="Tìm kiếm bài hát, nghệ sĩ, remix trên SoundCloud..." value="${this.escapeHtml(this.currentQuery||``)}">
            <button id="online-search-clear" class="icon-btn" style="min-height:32px;min-width:32px;${this.currentQuery?`display:inline-flex;`:`display:none;`}">${o.x}</button>
          </div>
          <button id="btn-online-search-submit" class="btn-primary" style="min-height:44px;padding:0 18px;font-weight:600;">
            Tìm
          </button>
          <!-- Suggestions Dropdown -->
          <div id="search-suggestions-dropdown" class="search-suggestions-dropdown" style="display:none;"></div>
        </div>

        <!-- SoundCloud Music Genre & Trend Chips -->
        <div class="yt-chip-bar" id="online-topic-chips" style="margin-bottom:16px;">
          <button class="yt-chip active" data-topic="">Tất cả</button>
          <button class="yt-chip" data-topic="vpop">V-Pop Hot</button>
          <button class="yt-chip" data-topic="sontung">Sơn Tùng M-TP</button>
          <button class="yt-chip" data-topic="denvau">Đen Vâu</button>
          <button class="yt-chip" data-topic="vu">Vũ.</button>
          <button class="yt-chip" data-topic="rapviet">Rap Việt</button>
          <button class="yt-chip" data-topic="remix">Remix TikTok</button>
          <button class="yt-chip" data-topic="lofi">Lofi Chill</button>
          <button class="yt-chip" data-topic="acoustic">Acoustic</button>
          <button class="yt-chip" data-topic="usuk">US-UK</button>
          <button class="yt-chip" data-topic="edm">EDM</button>
        </div>

        <!-- Dynamic Feed & Content Area -->
        <div id="online-content-area">
          <div id="online-feed-list" class="yt-video-grid">
            <div class="empty-state" style="grid-column: 1 / -1;">
              <p class="empty-title">Đang tải nhạc trực tuyến từ SoundCloud...</p>
            </div>
          </div>
        </div>
      </div>
    `,this.bindEvents();let e=this.currentQuery?this.searchItems:this.feedItems;e&&e.length>0?this.renderVideoCards(e,!!this.currentQuery):await this.fetchFeed(this.activeTopic||``)}bindEvents(){let t=document.getElementById(`online-search-input`),n=document.getElementById(`btn-online-search-submit`),r=document.getElementById(`online-search-clear`),a=document.getElementById(`search-suggestions-dropdown`),s=null,c=-1,l=[],u=()=>{a&&(a.style.display=`none`,a.innerHTML=``),c=-1,l=[]},d=e=>{if(a){if(!e||e.length===0){u();return}l=e,c=-1,a.innerHTML=e.map((e,t)=>{let n=this.escapeHtml(e);return`
          <div class="search-suggestion-item" data-index="${t}" data-val="${n}">
            <span class="suggestion-search-icon">${o.search}</span>
            <span class="suggestion-text">${n}</span>
            <button class="suggestion-insert-btn" type="button" data-val="${n}" title="Điền vào ô tìm kiếm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/>
                <polyline points="7 7 17 7 17 17"/>
              </svg>
            </button>
          </div>
        `}).join(``),a.style.display=`block`,a.querySelectorAll(`.search-suggestion-item`).forEach(e=>{e.addEventListener(`mousedown`,n=>{if(n.target.closest(`.suggestion-insert-btn`)){n.preventDefault(),n.stopPropagation();let e=n.target.closest(`.suggestion-insert-btn`).dataset.val;t&&(t.value=e,t.focus(),r&&(r.style.display=`inline-flex`),f(e));return}n.preventDefault();let i=e.dataset.val;t&&(t.value=i),u(),this.search(i)})})}},f=async e=>{if(!e||!e.trim()){u();return}try{let n=await i.youtube.suggest(e.trim());t&&t.value.trim()===e.trim()&&d(n.suggestions||[])}catch{}},p=()=>{let e=t?.value.trim();u(),e&&this.search(e)};n?.addEventListener(`click`,p),t?.addEventListener(`input`,()=>{let e=t.value;if(r&&(r.style.display=e?`inline-flex`:`none`),clearTimeout(s),!e.trim()){u();return}s=setTimeout(()=>{f(e)},150)}),t?.addEventListener(`focus`,()=>{let e=t.value.trim();e&&l.length>0?a.style.display=`block`:e&&f(e)}),t?.addEventListener(`keydown`,e=>{if(a&&a.style.display!==`none`&&l.length>0){let n=a.querySelectorAll(`.search-suggestion-item`);if(e.key===`ArrowDown`){e.preventDefault(),c=(c+1)%n.length,n.forEach((e,t)=>e.classList.toggle(`active`,t===c)),c>=0&&n[c]&&(n[c].scrollIntoView({block:`nearest`}),t.value=l[c]);return}if(e.key===`ArrowUp`){e.preventDefault(),c=(c-1+n.length)%n.length,n.forEach((e,t)=>e.classList.toggle(`active`,t===c)),c>=0&&n[c]&&(n[c].scrollIntoView({block:`nearest`}),t.value=l[c]);return}if(e.key===`Escape`){e.preventDefault(),u();return}}e.key===`Enter`&&(e.preventDefault(),p())}),document.addEventListener(`click`,e=>{e.target.closest(`.ytm-search-row`)||u()});let m=document.getElementById(`online-topic-chips`);m?.querySelectorAll(`.yt-chip`).forEach(e=>{e.addEventListener(`click`,()=>{m.querySelectorAll(`.yt-chip`).forEach(e=>e.classList.remove(`active`)),e.classList.add(`active`),this.activeTopic=e.dataset.topic||``,t&&(t.value=``),this.currentQuery=``,r&&(r.style.display=`none`),u(),this.fetchFeed(this.activeTopic)})}),r?.addEventListener(`click`,()=>{t&&(t.value=``),this.currentQuery=``,this.searchItems=null,r.style.display=`none`,u(),this.feedItems&&this.feedItems.length>0?this.renderVideoCards(this.feedItems,!1):this.fetchFeed(this.activeTopic||``)}),window.addEventListener(`online`,()=>{e.get().activeTab===`online`&&this.fetchFeed()}),window.addEventListener(`offline`,()=>{if(e.get().activeTab===`online`){let e=document.getElementById(`online-feed-list`);this.renderOfflineState(e)}})}isOffline(e){if(!navigator.onLine)return!0;if(!e)return!1;let t=(e.message||``).toLowerCase();return t.includes(`fetch`)||t.includes(`network`)||t.includes(`offline`)||t.includes(`failed`)||t.includes(`timeout`)||t.includes(`503`)||t.includes(`500`)||t.includes(`getaddrinfo`)||t.includes(`enotfound`)||t.includes(`urlopen`)||t.includes(`youtube`)}renderOfflineState(e){e&&(e.innerHTML=`
      <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 20px; text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
        </div>
        <p class="empty-title" style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Bạn đang offline</p>
        <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 380px; margin: 0 auto 20px; line-height: 1.5;">
          Không có kết nối mạng để nghe nhạc trực tuyến. Hãy chuyển sang nghe nhạc ở thư viện của bạn.
        </p>
        <button id="btn-goto-library" class="btn-primary" style="margin: 0 auto; min-height: 42px; padding: 0 22px; border-radius: 22px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <span>Chuyển sang nghe nhạc ở Thư viện</span>
        </button>
      </div>
    `,e.querySelector(`#btn-goto-library`)?.addEventListener(`click`,()=>{let e=document.querySelector(`.nav-item[data-tab="library"]`);e?e.click():window.app?.switchTab?window.app.switchTab(`library`):window.location.hash=`#library`}))}async switchChip(e){this.activeChip=e,this.container.querySelectorAll(`.yt-chip[data-chip]`).forEach(t=>{t.classList.toggle(`active`,t.dataset.chip===e)}),await this.loadActiveChipContent()}async loadActiveChipContent(e=!1){let t=document.getElementById(`online-content-area`);if(t){if(this.activeChip===`all`){t.innerHTML=`
        <div id="online-feed-list" class="yt-video-grid">
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p class="empty-title">Đang tải dữ liệu trực tuyến...</p>
          </div>
        </div>
      `;let n=this.currentQuery?this.searchItems:this.feedItems;n&&n.length>0&&!e?this.renderVideoCards(n,!!this.currentQuery):this.currentQuery?await this.search(this.currentQuery):await this.fetchFeed();return}if(!this.currentUser?.isGoogle){this.renderGooglePrompt(t,this.activeChip);return}t.innerHTML=`
      <div class="empty-state">
        <p class="empty-title">Đang tải dữ liệu trực tuyến...</p>
      </div>
    `;try{(!this.meData||e)&&(this.meData=await i.youtube.meData()),this.activeChip===`subscriptions`?this.renderSubscriptions(this.meData?.subscriptions||[]):this.activeChip===`liked`?this.renderLikedVideos(this.meData?.liked||[]):this.activeChip===`playlists`&&this.renderPlaylists(this.meData?.playlists||[])}catch(e){t.innerHTML=`
        <div class="empty-state">
          <p class="empty-title" style="color:#ef4444;">Không thể tải dữ liệu</p>
          <p style="font-size:0.85rem;color:var(--text-muted);">${this.escapeHtml(e.message)}</p>
        </div>
      `}}}renderGooglePrompt(e,t){let n=`Đăng nhập Google để xem kênh đã đăng ký`,r=`Đăng nhập bằng tài khoản Google để theo dõi các video mới nhất từ các kênh bạn yêu thích.`;t===`liked`?(n=`Đăng nhập Google để xem Video đã thích`,r=`Toàn bộ danh sách các bài hát và video bạn đã bấm thích sẽ hiển thị tại đây.`):t===`playlists`&&(n=`Đăng nhập Google để xem Danh sách phát`,r=`Nghe và phát lại tất cả danh sách phát bạn đã tạo.`),e.innerHTML=`
      <div class="empty-state" style="padding:60px 20px;max-width:440px;margin:0 auto;text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" style="color:var(--text-muted);">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/>
          </svg>
        </div>
        <h3 style="font-size:1.1rem;font-weight:600;margin:0 0 8px;">${n}</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 20px;line-height:1.4;">${r}</p>
        <button id="btn-prompt-google-login" class="pill-btn" style="background:#ffffff;color:#1f2937;font-weight:600;font-size:0.88rem;padding:8px 20px;border:none;margin:0 auto;display:inline-flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Đăng nhập bằng Google
        </button>
      </div>
    `,e.querySelector(`#btn-prompt-google-login`)?.addEventListener(`click`,()=>{new Xt(this.currentUser,e=>{window.app?.onUserChanged&&window.app.onUserChanged(e),this.currentUser=e,this.render()}).show()})}renderSubscriptions(e){let t=document.getElementById(`online-content-area`);if(t){if(e.length===0){t.innerHTML=`
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Không tìm thấy kênh đăng ký nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Tài khoản Google chưa có kênh đăng ký hoặc hãy bấm nút Đồng bộ.
          </p>
        </div>
      `;return}t.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:14px;">
        ${e.map(e=>`
          <div class="subscription-card" style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;align-items:center;gap:12px;">
            <img src="${e.thumbnail||``}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--bg-elevated);">
            <div style="min-width:0;flex:1;">
              <h4 style="font-size:0.88rem;font-weight:600;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(e.title)}">
                ${this.escapeHtml(e.title)}
              </h4>
              <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${this.escapeHtml(e.description||`Kênh nghệ sĩ`)}
              </p>
              <button class="pill-btn btn-search-channel" data-name="${this.escapeHtml(e.title)}" style="font-size:0.72rem;padding:3px 10px;min-height:26px;">
                Xem video
              </button>
            </div>
          </div>
        `).join(``)}
      </div>
    `,t.querySelectorAll(`.btn-search-channel`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.name,n=document.getElementById(`online-search-input`);n&&(n.value=t),this.switchChip(`all`),this.search(t)})})}}renderLikedVideos(e){let t=document.getElementById(`online-content-area`);if(t){if(e.length===0){t.innerHTML=`
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Chưa có video đã thích nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Hãy thích video trực tuyến hoặc bấm nút Đồng bộ lại.
          </p>
        </div>
      `;return}t.innerHTML=`
      <div id="online-feed-list" class="yt-video-grid"></div>
    `,this.renderVideoCards(e)}}renderPlaylists(t){let n=document.getElementById(`online-content-area`);if(n){if(t.length===0){n.innerHTML=`
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Chưa có Playlist nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Tài khoản của bạn chưa có playlist nào.
          </p>
        </div>
      `;return}n.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:16px;">
        ${t.map(e=>`
          <div class="yt-playlist-card" style="background:var(--bg-surface);border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border-subtle);display:flex;flex-direction:column;">
            <div style="position:relative;aspect-ratio:16/9;background:var(--bg-elevated);overflow:hidden;">
              <img src="${e.thumbnail||``}" alt="" style="width:100%;height:100%;object-fit:cover;">
              <div style="position:absolute;bottom:0;right:0;background:rgba(0,0,0,0.8);color:#fff;font-size:0.75rem;padding:4px 8px;border-top-left-radius:6px;display:flex;align-items:center;gap:4px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <span>${e.itemCount||0} bài</span>
              </div>
            </div>
            <div style="padding:12px;display:flex;flex-direction:column;flex:1;justify-content:space-between;gap:8px;">
              <div>
                <h4 style="font-size:0.88rem;font-weight:600;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(e.title)}">
                  ${this.escapeHtml(e.title)}
                </h4>
                ${e.description?`
                <p style="font-size:0.75rem;color:var(--text-muted);margin:0;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${this.escapeHtml(e.description)}
                </p>`:``}
              </div>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <button class="btn-primary btn-play-yt-playlist" data-id="${e.id}" data-type="audio" data-title="${this.escapeHtml(e.title)}" style="flex:1;font-size:0.78rem;padding:6px 8px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:4px;" title="Nghe playlist">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Nghe</span>
                </button>
                <button class="pill-btn btn-play-yt-playlist" data-id="${e.id}" data-type="video" data-title="${this.escapeHtml(e.title)}" style="flex:1;font-size:0.78rem;padding:6px 8px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:4px;" title="Xem playlist video">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span>Video</span>
                </button>
                <a href="https://www.youtube.com/playlist?list=${e.id}" target="_blank" class="pill-btn" style="font-size:0.78rem;padding:6px 10px;min-height:32px;display:inline-flex;align-items:center;" title="Mở liên kết">
                  ${o.externalLink}
                </a>
              </div>
            </div>
          </div>
        `).join(``)}
      </div>
    `,n.querySelectorAll(`.btn-play-yt-playlist`).forEach(t=>{t.addEventListener(`click`,async()=>{let n=t.dataset.id,r=t.dataset.title,a=t.dataset.type||`audio`,o=t.innerHTML;t.disabled=!0,t.textContent=`Đang tải...`;try{let t=await i.youtube.info(`https://www.youtube.com/playlist?list=${n}`),o=(t.items||t.entries||(t.id?[t]:[])).filter(e=>e&&e.id&&e.title!==`[Private video]`&&e.title!==`[Deleted video]`);if(o.length===0)throw Error(`Playlist không có bài hát nào hoặc là playlist riêng tư`);let s=o.map(e=>({id:`yt_${e.id}_${a}`,youtubeId:e.id,title:e.title,artist:e.channel||r,album:r,duration_sec:e.duration||0,media_type:a,isOnline:!0,isPlaylist:!0,thumbnail_url:e.thumbnail,publishedTime:e.publishedTime||``}));e.set({queue:s,originalQueue:s,isPlaylistMode:!0}),this.player.loadOnlineTrack(s[0],!0),this.player?.showToast(`Đang phát playlist "${r}" (${s.length} bài)`)}catch(e){alert(`Lỗi phát playlist: `+e.message)}finally{t.disabled=!1,t.innerHTML=o}})})}}async fetchFeed(e=``){this.currentQuery=``,this.page=1,this.hasMore=!0,this.renderedVideoIds.clear(),this.allItems=[];let t=document.getElementById(`online-feed-list`);if(!navigator.onLine){this.renderOfflineState(t);return}t&&(t.innerHTML=[,,,,,,].fill(0).map(()=>`
        <div class="video-card skeleton-card">
          <div class="skeleton-shimmer skeleton-thumb-16-9"></div>
          <div class="video-info" style="gap:8px;padding-top:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:85%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:50%;"></div>
          </div>
        </div>
      `).join(``)),this.isSearch=!1;try{let t=await i.soundcloud.getFeed(e,{page:1});this.feedItems=t.items||[],this.allItems=[...this.feedItems],this.activeChip===`all`&&this.renderVideoCards(this.feedItems,!1,!1)}catch{t&&this.renderOfflineState(t)}}async search(e){this.currentQuery=e,this.page=1,this.hasMore=!0,this.renderedVideoIds.clear(),this.allItems=[],this.isSearch=!0;let t=document.getElementById(`online-feed-list`);if(!navigator.onLine){this.renderOfflineState(t);return}t&&(t.innerHTML=[,,,,,,].fill(0).map(()=>`
        <div class="video-card skeleton-card">
          <div class="skeleton-shimmer skeleton-thumb-16-9"></div>
          <div class="video-info" style="gap:8px;padding-top:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:85%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:50%;"></div>
          </div>
        </div>
      `).join(``));try{let t=await i.soundcloud.search(e,{page:1});this.searchItems=t.items||[],this.allItems=[...this.searchItems],this.activeChip===`all`&&this.renderVideoCards(this.searchItems,!0,!1)}catch{t&&this.renderOfflineState(t)}}renderVideoCards(e,t=!1,n=!1){let r=!!(t||this.isSearch||this.currentQuery),a=document.getElementById(`online-feed-list`);if(!a)return;n||this.renderedVideoIds.clear();let o=(e||[]).filter(e=>!e||!e.id||this.renderedVideoIds.has(e.id)?!1:(this.renderedVideoIds.add(e.id),!0));if(!n&&o.length===0){a.innerHTML=`
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p class="empty-title">Không tìm thấy bài hát nào</p>
          <p>Thử tìm với từ khóa khác.</p>
        </div>
      `;return}let c=o.map(e=>{let t=this.player.formatTime(e.duration||0),n=e.viewsText||this.formatViews(e.views),r=(e.channel||`Y`).trim().charAt(0).toUpperCase();return`
        <div class="yt-video-card" data-id="${e.id}">
          <div class="yt-thumb-container">
            <img class="yt-thumb-img" src="${e.thumbnail}" alt="" loading="lazy">
            ${t?`<span class="yt-thumb-duration">${t}</span>`:``}
            <div class="yt-thumb-hover-overlay">
              <div class="yt-thumb-play-circle" title="Phát ngay">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <polygon points="6 4 19 12 6 20 6 4" />
                </svg>
              </div>
            </div>
          </div>

          <div class="yt-card-info-row">
            <div class="yt-channel-avatar" title="${this.escapeHtml(e.channel||``)}">
              ${r}
            </div>

            <div class="yt-card-meta-col">
              <h3 class="yt-card-title" title="${this.escapeHtml(e.title)}">
                ${this.escapeHtml(e.title)}
              </h3>
              
              <div class="yt-card-channel-name">
                <span>${this.escapeHtml(e.channel||``)}</span>
              </div>

              <div class="yt-card-stats">
                ${n?`<span>${n}</span>${e.publishedTime?` • `:``}`:``}${e.publishedTime?`<span>${this.escapeHtml(e.publishedTime)}</span>`:``}
              </div>

              <div class="yt-card-actions">
                <button class="yt-action-btn yt-action-audio btn-play-online-audio" data-id="${e.id}" title="Nghe âm thanh">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Nghe</span>
                </button>
                <button class="yt-action-btn yt-action-download btn-download-online" data-id="${e.id}" title="Tải về máy">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `}).join(``),l=`
      <div id="online-sentinel" style="grid-column: 1 / -1; height: 50px; display: flex; align-items: center; justify-content: center; margin: 16px 0;">
        <div class="infinite-loader" style="display:none;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
          <div style="width:16px;height:16px;border:2px solid var(--border-subtle);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span>Đang tải thêm bài hát...</span>
        </div>
      </div>
    `;if(n){let e=document.getElementById(`online-sentinel`);e?e.insertAdjacentHTML(`beforebegin`,c):a.insertAdjacentHTML(`beforeend`,c+l)}else a.innerHTML=c+l;let u=this.allItems.length>0?this.allItems:e;o.forEach(e=>{let t=a.querySelector(`.yt-video-card[data-id="${e.id}"]`);if(!t)return;t.querySelector(`.btn-play-online-audio`)?.addEventListener(`click`,t=>{t.stopPropagation(),this.playOnline(e,`audio`,r?null:u,r)});let n=t.querySelector(`.btn-download-online`);n?.addEventListener(`click`,t=>{t.stopPropagation(),s(n,e),this.player&&this.player.downloadTrackAudio?this.player.downloadTrackAudio({...e,id:`sc_${e.id}_audio`,soundcloudId:String(e.id),youtubeId:String(e.id),isOnline:!0,thumbnail_url:e.thumbnail||e.thumbnail_url,artist:e.channel||e.artist||`Nghệ sĩ`},n):this.player&&this.player.showDownloadModalForTrack?this.player.showDownloadModalForTrack({...e,id:`sc_${e.id}_audio`,soundcloudId:String(e.id),youtubeId:String(e.id),isOnline:!0,thumbnail_url:e.thumbnail||e.thumbnail_url,artist:e.channel||e.artist||`Nghệ sĩ`},n):i.soundcloud.download({url:e.url||`https://soundcloud.com/tracks/${e.id}`,id:e.id,mediaType:`audio`,quality:`HQ`,title:e.title,artist:e.channel||e.artist,thumbnail:e.thumbnail||e.thumbnail_url}).then(()=>{this.player?.showToast(`Đã thêm "${e.title}" vào tiến trình tải!`,2500)}).catch(e=>{alert(`Lỗi tải: `+e.message)})}),t.addEventListener(`click`,t=>{t.target.closest(`button`)||t.target.closest(`a`)||this.playOnline(e,`audio`,r?null:u,r)})}),this.setupInfiniteScroll()}setupInfiniteScroll(){this.observer&&=(this.observer.disconnect(),null);let e=document.getElementById(`online-sentinel`);e&&(this.observer=new IntersectionObserver(e=>{let t=e[0];t&&t.isIntersecting&&!this.isLoadingMore&&this.hasMore&&this.loadMore()},{rootMargin:`400px`}),this.observer.observe(e))}async loadMore(){if(this.isLoadingMore||!this.hasMore)return;this.isLoadingMore=!0;let e=document.getElementById(`online-sentinel`)?.querySelector(`.infinite-loader`);e&&(e.style.display=`flex`),this.page+=1;try{let t=[];if(t=this.currentQuery?((await i.soundcloud.search(this.currentQuery,{page:this.page})).items||[]).filter(e=>!this.renderedVideoIds.has(e.id)):((await i.soundcloud.getFeed(this.activeTopic||``,{page:this.page})).items||[]).filter(e=>!this.renderedVideoIds.has(e.id)),t.length===0){this.hasMore=!1,e&&(e.style.display=`none`);return}this.allItems=[...this.allItems,...t],this.currentQuery?this.searchItems=this.allItems:this.feedItems=this.allItems,this.renderVideoCards(t,!!this.currentQuery,!0)}catch(e){console.warn(`Infinite scroll error:`,e)}finally{this.isLoadingMore=!1,e&&(e.style.display=`none`)}}formatViews(e){return e?e>=1e6?`${(e/1e6).toFixed(1)}Tr lượt nghe`:e>=1e3?`${Math.round(e/1e3)}k lượt nghe`:`${e} lượt nghe`:``}playOnline(t,n=`audio`,r=null,i=!1){if(!navigator.onLine){this.player?.showToast(`Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.`,3500);return}e.set({isPlaylistMode:!1});let a={id:`sc_${t.id}_audio`,soundcloudId:String(t.id),youtubeId:String(t.id),title:t.title,artist:t.channel||t.artist||`Nghệ sĩ`,album:`SoundCloud Trực Tuyến`,duration_sec:t.duration||0,media_type:`audio`,isOnline:!0,thumbnail_url:t.thumbnail||t.thumbnail_url,publishedTime:t.publishedTime||``,source:`soundcloud`};e.set({queue:[a],originalQueue:[a],isPlaylistMode:!1}),this.player.loadOnlineTrack(a,!0)}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}},Qt=class{constructor(){this.player=null,this.libraryView=null,this.onlineView=null,this.playlistsView=null,this.settingsView=null,this.activeTab=`library`,this.eventSource=null,this.currentUser=null}async init(){window.app=this;try{localStorage.removeItem(`muzifi_cached_library`),localStorage.removeItem(`metube_cached_library`),localStorage.removeItem(`cloudbeats_state`)}catch{}n(()=>{this.showGoogleLoginScreen()}),`serviceWorker`in navigator&&(navigator.serviceWorker.register(`/sw.js`).then(()=>{this.preCacheLibraryForOffline()}).catch(e=>{console.warn(`SW registration notice:`,e)}),navigator.serviceWorker.addEventListener(`controllerchange`,()=>{this.preCacheLibraryForOffline()})),this.player=new y,this.pendingDeviceSaveTrackIds=new Set,e.set({pendingDeviceTrackIds:this.pendingDeviceSaveTrackIds}),this.libraryView=new te(this.player),this.onlineView=new Zt(this.player),this.player.onlineView=this.onlineView,this.playlistsView=new qt(this.player),this.settingsView=new Jt,window.app=this,window.player=this.player,this.bindNavigation(),this.bindHeaderActions(),e.subscribe(()=>{this.updateHeaderJobsBadge()}),this.initResumeHandler(),this.preventDoubleTapZoom(),window.addEventListener(`offline`,()=>{this.player?.showToast(`Đang ở chế độ Offline — Bạn vẫn có thể nghe/xem các bài trong Thư viện!`,3500)}),window.addEventListener(`online`,()=>{this.player?.showToast(`Đã kết nối mạng trở lại!`,2e3),this.preCacheLibraryForOffline()});try{let e=new URLSearchParams(window.location.search),t=e.get(`auth_token`);t&&(localStorage.setItem(`muzifi_token`,t),window.history.replaceState({},document.title,window.location.pathname+window.location.hash));let n=e.get(`auth_error`);n&&(window.history.replaceState({},document.title,window.location.pathname+window.location.hash),setTimeout(()=>{this.player?.showToast(`Lỗi đăng nhập: ${decodeURIComponent(n)}`,4e3)},500))}catch{}try{let e=await i.auth.check();if(!e.authenticated||!e.user||!e.user.isGoogle){this.showGoogleLoginScreen(e.googleConfigured);return}this.currentUser=e.user;try{localStorage.setItem(`muzifi_user`,JSON.stringify(e.user))}catch{}this.renderUserHeaderButton(),await this.onLoginSuccess()}catch{let e=localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`);if(!navigator.onLine&&e){let e=null;try{e=JSON.parse(localStorage.getItem(`muzifi_user`)||localStorage.getItem(`metube_user`))}catch{}this.currentUser=e||{name:`Người dùng offline`,isGoogle:!0},this.renderUserHeaderButton(),await this.onLoginSuccess();return}this.showGoogleLoginScreen()}}showGoogleLoginScreen(e=!0){if(document.getElementById(`google-login-gate`))return;this.player&&this.player.pause();let t=document.createElement(`div`);t.id=`google-login-gate`,t.style.cssText=`
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.18), transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.14), transparent 45%),
                  rgba(9, 13, 22, 0.98);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      overflow-y: auto;
    `,t.innerHTML=`
      <div style="background: rgba(17, 24, 39, 0.88); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 44px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
        
        <!-- App Logo Only -->
        <div style="margin: 0 auto 36px; display: flex; align-items: center; justify-content: center;">
          <img src="/logo.png" alt="Logo" style="max-width: 180px; max-height: 90px; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.45));">
        </div>

        <!-- Google Login Button -->
        <button id="btn-gate-google-signin" class="pill-btn" style="width: 100%; min-height: 50px; background: #ffffff; color: #1e293b; font-weight: 700; font-size: 0.96rem; border: none; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer; transition: all 0.2s ease;">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        <!-- Legal Links -->
        <div style="margin-top: 24px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); display: flex; justify-content: center; align-items: center; gap: 14px;">
          <a href="/privacy" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Chính sách bảo mật</a>
          <span style="opacity: 0.4;">&bull;</span>
          <a href="/terms" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Điều khoản dịch vụ</a>
        </div>
      </div>
    `,document.body.appendChild(t),document.getElementById(`btn-gate-google-signin`)?.addEventListener(`click`,async()=>{let e=document.getElementById(`btn-gate-google-signin`);try{e.disabled=!0,e.innerHTML=`<span>Đang chuyển hướng sang Google...</span>`;let t=await i.auth.googleUrl();t.url&&(window.location.href=t.url)}catch(t){e.disabled=!1,e.innerHTML=`<span>Tiếp tục với Google</span>`,alert(t.message||`Lỗi kết nối Google OAuth`)}})}async onLoginSuccess(){e.set({isAuthenticated:!0}),this.switchTab(`library`),navigator.onLine&&(this.startSSE(),this.startJobsPoller(),i.jobs.list().then(t=>{e.setJobs(t),this.updateHeaderJobsBadge()}).catch(()=>{})),await this.restorePlayerState(),navigator.onLine&&this.preCacheLibraryForOffline()}async syncLibraryWithDevice(e=!1){try{let e=(await i.tracks.list({limit:1e3})).tracks||[];if(e.length===0)return;try{localStorage.setItem(`muzifi_cached_library`,JSON.stringify(e))}catch{}let t=await h(),n=e.filter(e=>!t.has(e.id));if(n.length===0)return;let r=0,a=0,o=async()=>{for(;r<n.length;){let e=n[r++];if(!e)break;try{await _(e),a++,this.libraryView?.checkCachedTracks&&this.libraryView.checkCachedTracks()}catch(t){console.warn(`Sync error on track ${e.id}:`,t)}await new Promise(e=>setTimeout(e,150))}},s=[];for(let e=0;e<Math.min(2,n.length);e++)s.push(o());await Promise.all(s),a>0&&this.libraryView?.checkCachedTracks&&this.libraryView.checkCachedTracks()}catch(e){console.warn(`syncLibraryWithDevice notice:`,e)}}async preCacheLibraryForOffline(){return this.syncLibraryWithDevice(!1)}async downloadTrackToDevice(e,t=``,n=null){if(e)try{await _({id:e,title:t},``,n),this.activeTab===`library`&&this.libraryView?.checkCachedTracks?.()}catch(e){console.warn(`downloadTrackToDevice error:`,e)}}cacheSingleTrackForOffline(e,t=``){e&&this.downloadTrackToDevice(e,t).catch(()=>{})}startSSE(){if(!navigator.onLine)return;this.eventSource&&this.eventSource.close();let t=localStorage.getItem(`muzifi_token`)||localStorage.getItem(`metube_token`),n=t?`/api/jobs/stream?token=${encodeURIComponent(t)}`:`/api/jobs/stream`;this.eventSource=new EventSource(n),this.eventSource.onmessage=t=>{try{let n=JSON.parse(t.data);n.type===`init`&&Array.isArray(n.jobs)?e.setJobs(n.jobs):n.id&&(n.status===`done`?n.track_id?(this.pendingDeviceSaveTrackIds.add(n.track_id),e.set({pendingDeviceTrackIds:new Set(this.pendingDeviceSaveTrackIds)}),n.deviceSaving=!0,n.deviceProgress=5,e.updateJob(n),this.updateHeaderJobsBadge(),this.downloadTrackToDevice(n.track_id,n.title,t=>{n.deviceSaving=!0,n.deviceProgress=t.percent,n.deviceLoadedMb=t.loadedMb,n.deviceTotalMb=t.totalMb,e.updateJob(n),this.updateHeaderJobsBadge()}).finally(()=>{this.pendingDeviceSaveTrackIds.delete(n.track_id),e.set({pendingDeviceTrackIds:new Set(this.pendingDeviceSaveTrackIds)}),n.deviceSaving=!1,e.updateJob(n),this.updateHeaderJobsBadge(),this.activeTab===`library`&&this.libraryView?.fetchAndRenderTracks?.()})):(e.updateJob(n),this.updateHeaderJobsBadge(),this.activeTab===`library`&&this.libraryView?.fetchAndRenderTracks?.()):(e.updateJob(n),this.updateHeaderJobsBadge()))}catch(e){console.warn(`SSE parse notice:`,e)}},this.eventSource.onerror=()=>{}}startJobsPoller(){this.jobsPollTimer&&clearInterval(this.jobsPollTimer),this.jobsPollTimer=setInterval(async()=>{if(!navigator.onLine)return;let t=e.get().jobs||[];if(t.some(e=>e.status===`downloading`||e.status===`processing`||e.status===`queued`||e.deviceSaving))try{let n=await i.jobs.list();if(!Array.isArray(n))return;for(let r of n){let n=t.find(e=>e.id===r.id);n&&n.deviceSaving?(r.deviceSaving=!0,r.deviceProgress=n.deviceProgress,r.deviceLoadedMb=n.deviceLoadedMb,r.deviceTotalMb=n.deviceTotalMb):r.status===`done`&&r.track_id&&!this.pendingDeviceSaveTrackIds.has(r.track_id)&&(await p(r.track_id)||(this.pendingDeviceSaveTrackIds.add(r.track_id),e.set({pendingDeviceTrackIds:new Set(this.pendingDeviceSaveTrackIds)}),r.deviceSaving=!0,r.deviceProgress=5,this.downloadTrackToDevice(r.track_id,r.title,t=>{r.deviceSaving=!0,r.deviceProgress=t.percent,r.deviceLoadedMb=t.loadedMb,r.deviceTotalMb=t.totalMb,e.updateJob(r),this.updateHeaderJobsBadge()}).finally(()=>{this.pendingDeviceSaveTrackIds.delete(r.track_id),e.set({pendingDeviceTrackIds:new Set(this.pendingDeviceSaveTrackIds)}),r.deviceSaving=!1,e.updateJob(r),this.updateHeaderJobsBadge(),this.activeTab===`library`&&this.libraryView?.fetchAndRenderTracks?.()})))}e.setJobs(n),this.updateHeaderJobsBadge()}catch{}},2500)}updateHeaderJobsBadge(){let t=document.getElementById(`btn-header-jobs`),n=document.getElementById(`jobs-ring-fill`),r=document.getElementById(`jobs-percent-badge`),i=document.getElementById(`jobs-icon-symbol`),a=document.getElementById(`settings-jobs-badge`),o=e.get().jobs||[],s=o.filter(e=>e.status===`downloading`||e.status===`processing`||e.deviceSaving),c=o.filter(e=>e.status===`queued`),l=s.length+c.length;a&&(l>0?(a.textContent=l,a.style.display=`flex`):a.style.display=`none`);let u=document.getElementById(`btn-lib-downloading`),d=document.getElementById(`lib-dl-percent`),f=s.find(e=>e.deviceSaving);if(l>0){let e=0;if(s.length>0){let t=s.reduce((e,t)=>e+(t.deviceSaving?t.deviceProgress||10:t.progress||0),0);e=Math.round(t/s.length),e=Math.min(99,Math.max(1,e))}t&&(t.classList.add(`is-downloading`),t.classList.remove(`is-idle`),t.title=f&&f.deviceLoadedMb&&f.deviceTotalMb?`Lưu vào máy: ${f.deviceLoadedMb}/${f.deviceTotalMb}MB (${e}%)`:f?`Đang lưu về máy: ${e}%`:s.length===0&&c.length>0?`Đang xếp hàng chờ tải (${c.length} bài)`:`Đang tải: ${e}% (${l} bài)`),n&&n.setAttribute(`stroke-dasharray`,`${e}, 100`),r&&(r.textContent=f?`${e}%`:s.length===0&&c.length>0?`Chờ`:l>1?`${e}% (${l})`:`${e}%`,r.style.display=`inline`),i&&(i.innerHTML=`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`),u&&(u.style.display=`inline-flex`,d&&(d.textContent=f&&f.deviceLoadedMb&&f.deviceTotalMb?`${f.deviceLoadedMb}/${f.deviceTotalMb}MB (${e}%)`:f?`Lưu máy: ${e}%`:s.length===0&&c.length>0?`Đang xếp hàng (${l} bài)`:`${e}% (${l} bài)`))}else t&&(t.classList.remove(`is-downloading`),t.classList.add(`is-idle`),t.title=`Tiến trình tải nhạc`),n&&n.setAttribute(`stroke-dasharray`,`0, 100`),r&&(r.style.display=`none`),u&&(u.style.display=`none`)}async restorePlayerState(){try{let t=localStorage.getItem(`cloudbeats_state`),n=null,r=0;if(t){let i=JSON.parse(t);n=i.trackId,r=i.positionSec||0,i.playbackRate&&e.set({playbackRate:i.playbackRate}),i.loopMode&&this.player.setLoopMode(i.loopMode),i.isShuffle&&(e.set({isShuffle:!0}),this.player.shuffleBtn&&this.player.shuffleBtn.classList.add(`active`))}if(navigator.onLine)try{let e=await i.player.getState();!n&&e&&e.track_id&&(n=e.track_id,r=e.position_sec||0)}catch{}if(n){let t=e.get().tracks||[];if(t.length===0)try{t=(await i.tracks.list({limit:100})).tracks||[]}catch{let e=localStorage.getItem(`muzifi_cached_library`)||localStorage.getItem(`metube_cached_library`);e&&(t=JSON.parse(e))}let a=(t||[]).find(e=>e.id===n);a&&(e.set({queue:t}),await this.player.loadTrack(a,!1,r))}}catch(e){console.warn(`Restore state notice:`,e)}}bindNavigation(){let e=window.location.hostname===`localhost`||window.location.hostname===`127.0.0.1`,t=document.querySelector(`.nav-item[data-tab="settings"]`);t&&(t.style.display=e?`flex`:`none`),document.querySelectorAll(`.nav-item`).forEach(t=>{t.addEventListener(`click`,()=>{let n=t.dataset.tab;(n!==`settings`||e)&&this.switchTab(n)})})}switchTab(t){let n=window.location.hostname===`localhost`||window.location.hostname===`127.0.0.1`;t===`settings`&&!n&&(t=`library`),this.activeTab=t,e.set({activeTab:t}),document.querySelectorAll(`.nav-item`).forEach(e=>{e.classList.toggle(`active`,e.dataset.tab===t)}),t===`library`?this.libraryView.render():t===`online`?this.onlineView.render():t===`playlists`?this.playlistsView.render():t===`settings`&&this.settingsView.render()}bindHeaderActions(){let e=document.getElementById(`btn-header-add`);e&&e.addEventListener(`click`,()=>{new Yt(()=>{this.activeTab===`library`&&this.libraryView.fetchAndRenderTracks()}).show()});let t=document.getElementById(`btn-header-jobs`);t&&t.addEventListener(`click`,()=>{new ee(()=>{this.activeTab===`library`&&this.libraryView.fetchAndRenderTracks()}).show()})}initResumeHandler(){let e=Date.now(),t=()=>{let t=Date.now();if(t-e<200)return;e=t,document.body.style.transform=`scale(1)`,document.body.offsetHeight,document.body.style.transform=``,this.player&&this.player.onForegroundResume(),this.eventSource&&this.eventSource.readyState===EventSource.CLOSED&&this.startSSE(),window.dispatchEvent(new Event(`resize`));let n=new URLSearchParams(window.location.search).get(`auth_token`);n&&(localStorage.setItem(`muzifi_token`,n),window.history.replaceState({},document.title,window.location.pathname+window.location.hash)),document.getElementById(`google-login-gate`)?i.auth.check().then(e=>{e.authenticated&&e.user&&e.user.isGoogle&&(this.currentUser=e.user,this.renderUserHeaderButton(),this.onLoginSuccess())}).catch(()=>{}):this.currentUser&&navigator.onLine&&this.syncLibraryWithDevice(!1)};document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&t()}),window.addEventListener(`pageshow`,()=>{t()}),window.addEventListener(`focus`,()=>{t()})}preventDoubleTapZoom(){let e=0;document.addEventListener(`touchend`,t=>{if(t.target&&t.target.closest(`button, a, input, textarea, select, .nav-item, .track-item, .icon-btn, .pill-btn, [role="button"]`))return;let n=Date.now();n-e<=300&&t.preventDefault(),e=n},{passive:!1})}renderUserHeaderButton(){let e=document.getElementById(`header-user-btn-container`),t=document.querySelector(`.header-right`);if(!e&&t&&(e=document.createElement(`div`),e.id=`header-user-btn-container`,t.prepend(e)),!e)return;let n=this.currentUser;e.innerHTML=`
      <button id="btn-header-user" class="pill-btn" style="padding:4px 10px 4px 6px;gap:8px;font-size:0.8rem;font-weight:600;display:flex;align-items:center;border-radius:20px;background:var(--bg-surface);border:1px solid var(--border-subtle);cursor:pointer;" title="Tài khoản: ${this.escapeHtml(n?.name||`Người dùng`)}">
        <div style="width:24px;height:24px;border-radius:50%;overflow:hidden;background:var(--accent-primary, #6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;flex-shrink:0;">
          ${n?.avatar?`<img src="${n.avatar}" style="width:100%;height:100%;object-fit:cover;">`:n?.name?.slice(0,1)?.toUpperCase()||`U`}
        </div>
        <span style="max-width:85px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${this.escapeHtml(n?.name||`Tài khoản`)}
        </span>
      </button>
    `,document.getElementById(`btn-header-user`)?.addEventListener(`click`,()=>{new Xt(this.currentUser,e=>this.onUserChanged(e)).show()})}async onUserChanged(e){this.currentUser=e,this.renderUserHeaderButton(),this.player?.showToast(`Đã chuyển sang tài khoản ${e.name}`,3e3),this.activeTab===`library`?this.libraryView.render():this.activeTab===`playlists`?this.playlistsView.render():this.activeTab===`online`&&(this.onlineView.currentUser=e,this.onlineView.render()),await this.restorePlayerState()}escapeHtml(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`):``}};document.addEventListener(`DOMContentLoaded`,()=>{let e=new Qt;window.app=e,e.init()});