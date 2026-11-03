'use strict';
(() => {
  const data = window.EILAN_CONTENT;
  if (!data) { document.body.innerHTML = '<p style="color:white;padding:30px">ملف content.js مو موجود. تأكد إن كل ملفات الموقع بنفس المجلد.</p>'; return; }
  const $ = (id) => document.getElementById(id);
  const screens = ['gate','resumeScreen','opening','journey','finale'];
  const storeKey = 'eilan-universe-v1';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const emptyProgress = () => ({stage:0,index:0,maxIndices:Array(data.planets.length).fill(-1),seen:[],favorites:[],started:false,finished:false});
  const readProgress = () => {
    try {
      const x=JSON.parse(localStorage.getItem(storeKey));
      if (!x || typeof x !== 'object') return emptyProgress();
      return {...emptyProgress(),...x,maxIndices:Array.isArray(x.maxIndices)?x.maxIndices.slice(0,7):Array(7).fill(-1),seen:Array.isArray(x.seen)?x.seen:[],favorites:Array.isArray(x.favorites)?x.favorites:[]};
    } catch (_) { return emptyProgress(); }
  };
  let state=readProgress();
  let activeStage=0, photoIndex=0, auto=false, typingTimer=null, autoTimer=null, toastTimer=null, transitionTimer=null;
  let currentView='gate', previousFocus=null, modalVideo=null, isModalOpen=false;
  let videoObserver=null;
  const save = () => {try{localStorage.setItem(storeKey,JSON.stringify(state));}catch(_){}};
  const display = (view) => {
    currentView=view;
    screens.forEach(id=>$(id).classList.toggle('is-hidden',id!==view));
    const isJourney = view==='journey';
    $('topBar').classList.toggle('is-hidden',!isJourney);
    $('stageProgress').classList.toggle('is-hidden',!isJourney);
    $('wishStars').style.display=(view==='gate' || view==='resumeScreen')?'none':'';
    window.scrollTo({top:0,behavior:'instant'});
  };
  const normalize = (str) => String(str).normalize('NFKC').trim().toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,'');
  const ping = (message) => {const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);};
  const onlyKey = (i,j)=>`${i}:${j}`;
  const hasSeen=(i,j)=>state.seen.includes(onlyKey(i,j));
  const markSeen=(i,j)=>{
    if(!hasSeen(i,j))state.seen.push(onlyKey(i,j));
    state.maxIndices[i]=Math.max(Number(state.maxIndices[i]||-1),j);
    save();
  };
  const imagePath=(p,i)=>`${p.folder}/${p.prefix}${i+1}${p.extension}`;
  const canGoNext=()=>{const p=data.planets[activeStage];return p.display==='videos'||(photoIndex===p.count-1&&hasSeen(activeStage,photoIndex));};
  const cancelAutoTimer=()=>{clearTimeout(autoTimer);autoTimer=null;};
  const cancelTyping=()=>{clearTimeout(typingTimer);typingTimer=null;};
  const pauseAuto=()=>{cancelAutoTimer();cancelTyping();};
  const music=$('music');
  music.volume=.67;
  const startMusic=()=>{
    music.muted=false;
    if(music.paused){const p=music.play();if(p&&p.catch)p.catch(()=>{});}
  };
  $('riddleQuestion').textContent=data.question;
  $('riddleForm').addEventListener('submit',(e)=>{
    e.preventDefault();
    const given=normalize($('riddleAnswer').value);
    if(!data.answers.some(x=>normalize(x)===given)){
      $('gateFeedback').classList.add('error');$('gateFeedback').textContent='قريبة يا روحي... فكّري باسم أغلى بنية بگَلبي ♡';
      $('riddleAnswer').focus();return;
    }
    $('gateFeedback').classList.remove('error');
    startMusic();
    if(state.started){display('resumeScreen');}
    else enterOpening();
  });
  const runBurst=()=>{
    const field=$('burstField');field.replaceChildren();
    if(reduced)return;
    for(let i=0;i<85;i++){
      const el=document.createElement('i');el.className='burst-particle';
      const angle=(i/85)*Math.PI*2,dist=85+(i%9)*30;
      el.style.setProperty('--bx',`${Math.cos(angle)*dist}px`);el.style.setProperty('--by',`${Math.sin(angle)*dist}px`);
      el.style.animationDelay=`${(i%7)*.045}s`;field.append(el);
    }
  };
  const enterOpening=()=>{display('opening');runBurst();};
  $('resumeButton').addEventListener('click',()=>{activeStage=Math.max(0,Math.min(6,Number(state.stage)||0));photoIndex=Math.max(0,Number(state.index)||0);if(state.finished)renderFinale();else enterPlanet(activeStage,photoIndex,false);});
  $('freshButton').addEventListener('click',()=>{state={...emptyProgress(),favorites:state.favorites};save();enterOpening();});
  $('launchButton').addEventListener('click',()=>{state.started=true;save();enterPlanet(0,0,true);});
  const transitionLabels=['نمر من نجوم إيلان...', 'بوابة الذكريات تنفتح...', 'نسافر لصوت نحبّه...', 'تلمع حروفنا بين الكواكب...', 'نقترب من أجمل قلب...', 'نسبح بين لحظاتنا...', 'نقترب من حلم باچر...'];
  const travel=(callback,idx)=>{
    clearTimeout(transitionTimer);
    if(reduced){callback();return;}
    $('transitionText').textContent=transitionLabels[(idx+transitionLabels.length)%transitionLabels.length];
    const t=$('transitionScreen');t.classList.remove('is-hidden');t.setAttribute('aria-hidden','false');
    transitionTimer=setTimeout(()=>{t.classList.add('is-hidden');t.setAttribute('aria-hidden','true');callback();},900);
  };
  const buildTimeline=()=>{
    const box=$('timeline');box.replaceChildren();
    data.planets.forEach((_,i)=>{const dot=document.createElement('span');dot.className='timeline-dot'+(i<=activeStage?' visited':'')+(i===activeStage?' active':'');dot.title=`الكوكب ${i+1}`;box.append(dot);});
    $('stageCount').textContent=`${String(activeStage+1).padStart(2,'0')} / 07`;
    $('stageProgress').firstElementChild.style.width=`${((activeStage+1)/data.planets.length)*100}%`;
  };
  const enterPlanet=(stage,idx=0,animate=false)=>{
    closeMedia();clearTimeout(typingTimer);cancelAutoTimer();auto=false;$('autoplayButton').classList.remove('active');$('autoplayButton').setAttribute('aria-pressed','false');$('autoplayButton').textContent='▷ عرض تلقائي';
    if(videoObserver){videoObserver.disconnect();videoObserver=null;}
    document.querySelectorAll('#storyContent video').forEach(v=>v.pause());
    activeStage=Math.max(0,Math.min(data.planets.length-1,stage));photoIndex=Math.max(0,Math.min(data.planets[activeStage].count-1,idx));
    state.stage=activeStage;state.index=photoIndex;state.started=true;save();
    const launch=()=>{
      display('journey');buildTimeline();
      const p=data.planets[activeStage];
      $('planetEyebrow').textContent=`PLANET ${String(activeStage+1).padStart(2,'0')} / 07 · ${p.english}`;
      $('planetTitle').textContent=p.name;$('planetDescription').textContent=p.description;$('chapterLabel').textContent=p.chapter;
      $('planetArt').className=`planet-art ${p.color}`;
      $('backPlanet').disabled=activeStage===0;
      if(p.display==='videos')renderVideos();else renderPhoto();
      window.scrollTo({top:0,behavior:'instant'});
    };
    if(animate)travel(launch,activeStage);else launch();
  };
  const placeholder=(path)=>{
    const missing=document.createElement('div');missing.className='photo-missing';
    const star=document.createElement('span');star.style.fontSize='36px';star.textContent='✧';
    const name=document.createElement('b');name.textContent=path;
    const help=document.createElement('span');help.textContent='حطّي الملف بهذا الاسم داخل المجلد';
    missing.append(star,name,help);return missing;
  };
  const makeImg=(src,alt)=>{
    const img=document.createElement('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>{if(img.isConnected)img.replaceWith(placeholder(src));},{once:true});
    return img;
  };
  const captionNow=()=>{
    const p=data.planets[activeStage];return (p.captions||[])[photoIndex]||'';
  };
  const typeCaption=(txt)=>{
    cancelTyping();cancelAutoTimer();
    const el=$('typedCaption');el.textContent='';el.classList.add('typing');
    let at=0;
    if(reduced){el.textContent=txt;el.classList.remove('typing');scheduleNext();return;}
    const tick=()=>{
      if(currentView!=='journey')return;
      // Array.from handles emoji without splitting surrogate pairs
      const chars=Array.from(txt);
      el.textContent=chars.slice(0,at).join('');
      if(at>=chars.length){el.classList.remove('typing');typingTimer=null;scheduleNext();return;}
      at=Math.min(chars.length,at+((chars[at]==='\n')?2:1));
      typingTimer=setTimeout(tick,24);
    };tick();
  };
  const scheduleNext=()=>{
    if(!auto || isModalOpen || currentView!=='journey')return;
    const p=data.planets[activeStage];
    if(p.display==='videos' || !hasSeen(activeStage,photoIndex))return;
    cancelAutoTimer();
    if(photoIndex < p.count-1)autoTimer=setTimeout(()=>movePhoto(1),12000);
    else {auto=false;renderAuto();}
  };
  const renderAuto=()=>{const b=$('autoplayButton');b.textContent=auto?'Ⅱ إيقاف العرض':'▷ عرض تلقائي';b.classList.toggle('active',auto);b.setAttribute('aria-pressed',String(auto));};
  const updateControls=()=>{
    const p=data.planets[activeStage];const end=canGoNext();
    $('previousPhoto').disabled=photoIndex===0;
    $('nextPhoto').disabled=photoIndex===p.count-1 || !hasSeen(activeStage,photoIndex);
    $('photoIndex').textContent=String(photoIndex+1).padStart(2,'0');$('photoTotal').textContent=String(p.count).padStart(2,'0');
    $('nextPlanet').disabled=!end;
    $('nextPlanet').textContent=end?(activeStage===6?'افتحي نهاية المجرّة ✨':'الكوكب التالي ←'):'أكملي الذكريات أولاً ♡';
    $('planetCompletion').textContent=end?'خلصتي هالكوكب يا نجمة گَلبي... يلا للّي بعده ♡':'عيشي كل ذكرى بالترتيب حتى ينفتح الكوكب اللي بعده ✨';
    const key=onlyKey(activeStage,photoIndex),liked=state.favorites.includes(key);
    $('heartButton').classList.toggle('loved',liked);$('heartButton').setAttribute('aria-pressed',String(liked));$('heartSymbol').textContent=liked?'♥':'♡';$('heartText').textContent=liked?'هاي الذكرى بگلبي':'حبي هاي الذكرى';
  };
  const makePhotoShell=(p,idx)=>{
    const shell=document.createElement('div');shell.className='photo-shell '+(p.display==='museum'?'museum':p.display==='calls'?'call-screen':p.display==='together'?'together-frame':p.display==='stars'?'spotlight':'')+(idx===p.count-1?' last-memory':'');
    const src=imagePath(p,idx);const alt=`${p.name} — الصورة ${idx+1}`;
    if(p.display==='calls'){
      const b=document.createElement('span');b.className='call-badge';b.textContent='✦ اتصال من إيلاني';shell.append(b);
    }
    if(p.display==='together'){
      const halo=document.createElement('span');halo.className='heart-halo';shell.append(halo);
    }
    const btn=document.createElement('button');btn.type='button';btn.className='media-trigger';btn.setAttribute('aria-label','تكبير الصورة وقراءة تفاصيلها');
    btn.append(makeImg(src,alt));
    const hint=document.createElement('span');hint.className='zoom-hint';hint.textContent='⌕ تكبير الصورة';btn.append(hint);
    btn.addEventListener('click',()=>openImageModal(src,captionNow()));
    shell.append(btn);
    if(idx===p.count-1){const special=document.createElement('span');special.className='last-memory-label';special.textContent='✦ ذكرى أخيرة، بس الحب ما يخلص';shell.append(special);}
    if(p.display==='calls'){
      const act=document.createElement('div');act.className='call-actions';act.innerHTML='<span>♬</span><span>◉</span><span>♥</span>';shell.append(act);
    }
    return shell;
  };
  const renderMessage=(p)=>{
    const area=$('storyContent');area.replaceChildren();const key=onlyKey(activeStage,photoIndex);
    if(hasSeen(activeStage,photoIndex)){
      const box=document.createElement('div');box.className='message-revealed';
      const b=document.createElement('span');b.className='message-chat-bubble';b.textContent='💌 من حچينا سوه';box.append(b);
      const btn=document.createElement('button');btn.className='flip-card';btn.type='button';btn.setAttribute('aria-label','تكبير صورة الرسائل');
      btn.append(makeImg(imagePath(p,photoIndex),`صورة محادثتنا ${photoIndex+1}`));
      btn.addEventListener('click',()=>openImageModal(imagePath(p,photoIndex),captionNow()));
      box.append(btn);area.append(box);
      return;
    }
    const box=document.createElement('div');box.className='envelope-shell';
    const envelope=document.createElement('div');envelope.className='envelope-flap';envelope.innerHTML='<span>♥</span>';
    const label=document.createElement('p');label.textContent=`الظرف ${photoIndex+1} من ${p.count} — بيه ذكرى تنتظرج`;
    const btn=document.createElement('button');btn.type='button';btn.className='primary-btn';btn.textContent='افتحي الظرف 💌';
    btn.addEventListener('click',()=>{markSeen(activeStage,photoIndex);renderMessage(p);updateControls();if(auto&&!typingTimer)scheduleNext();});
    box.append(envelope,label,btn);area.append(box);
  };
  const renderPhoto=()=>{
    const p=data.planets[activeStage];const area=$('storyContent');area.replaceChildren();area.style.padding='';
    $('captionArea').classList.remove('is-hidden');$('storyActions').classList.remove('is-hidden');$('heartButton').classList.remove('is-hidden');$('autoplayButton').classList.remove('is-hidden');
    if(p.display==='messages'){renderMessage(p);}else{area.append(makePhotoShell(p,photoIndex));markSeen(activeStage,photoIndex);}
    state.index=photoIndex;save();updateControls();typeCaption(captionNow());
  };
  const movePhoto=(delta)=>{
    if(currentView!=='journey'||isModalOpen)return;
    const p=data.planets[activeStage];if(p.display==='videos')return;
    if(delta>0&&!hasSeen(activeStage,photoIndex))return;
    const target=Math.max(0,Math.min(p.count-1,photoIndex+delta));if(target===photoIndex)return;
    photoIndex=target;renderPhoto();
  };
  $('previousPhoto').addEventListener('click',()=>movePhoto(-1));
  $('nextPhoto').addEventListener('click',()=>movePhoto(1));
  $('autoplayButton').addEventListener('click',()=>{auto=!auto;cancelAutoTimer();renderAuto();if(auto&&!typingTimer)scheduleNext();});
  $('heartButton').addEventListener('click',()=>{
    const key=onlyKey(activeStage,photoIndex),idx=state.favorites.indexOf(key);
    if(idx<0){state.favorites.push(key);$('heartButton').classList.add('pop');setTimeout(()=>$('heartButton').classList.remove('pop'),500);ping('هاي الذكرى صارت بقلبج ♡');}
    else state.favorites.splice(idx,1);
    save();updateControls();
  });
  $('backPlanet').addEventListener('click',()=>{if(activeStage>0)enterPlanet(activeStage-1,Number(state.maxIndices[activeStage-1])>=0?Number(state.maxIndices[activeStage-1]):0,true);});
  $('nextPlanet').addEventListener('click',()=>{if(!canGoNext())return;if(activeStage>=6)travel(renderFinale,6);else enterPlanet(activeStage+1,0,true);});
  const createVideo=(num)=>{
    const video=document.createElement('video');
    video.muted=true;video.defaultMuted=true;video.setAttribute('muted','');video.loop=true;video.playsInline=true;video.setAttribute('playsinline','');video.preload='none';video.setAttribute('webkit-playsinline','');video.poster='';video.setAttribute('aria-label',`الفيديو ${num}`);
    const mp4=document.createElement('source');mp4.src=`Videos/video${num}.mp4`;mp4.type='video/mp4';
    const mov=document.createElement('source');mov.src=`Videos/video${num}.mov`;mov.type='video/quicktime';
    video.append(mp4,mov);
    return video;
  };
  const observeVideos=()=>{
    videoObserver?.disconnect();
    const items=document.querySelectorAll('#storyContent video');
    videoObserver=new IntersectionObserver(entries=>{
      for(const e of entries){const v=e.target;
        if(e.isIntersecting&&!isModalOpen&&currentView==='journey'){
          const play=v.play();if(play&&play.catch)play.catch(()=>{});
        }else v.pause();
      }
    },{threshold:.30});
    items.forEach(v=>videoObserver.observe(v));
  };
  const renderVideos=()=>{
    const p=data.planets[activeStage];const area=$('storyContent');area.replaceChildren();area.style.padding='12px';
    const grid=document.createElement('div');grid.className='video-grid';
    for(let i=0;i<p.count;i++){
      const card=document.createElement('article');card.className='video-card'+(i%3===0?' featured':'');
      const btn=document.createElement('button');btn.type='button';btn.className='video-open';btn.setAttribute('aria-label',`فتح الفيديو ${i+1} بحجم كبير`);
      const v=createVideo(i+1);btn.append(v);
      const openLabel=document.createElement('span');openLabel.textContent='⤢ تكبير';btn.append(openLabel);
      btn.addEventListener('click',()=>openVideoModal(i+1,p.videoCaptions[i]));
      const caption=document.createElement('p');caption.textContent=p.videoCaptions[i];
      card.append(btn,caption);grid.append(card);
    }
    area.append(grid);
    const tip=document.createElement('p');tip.className='video-progress';tip.textContent='الفيديوهات تشتغل بصمت وتتكرر من تكون ظاهرة... والأغنية تبقى شغالة ♡';area.append(tip);
    $('captionArea').classList.add('is-hidden');$('storyActions').classList.add('is-hidden');$('heartButton').classList.add('is-hidden');$('autoplayButton').classList.add('is-hidden');
    $('photoIndex').textContent='09';$('photoTotal').textContent='09';$('nextPlanet').disabled=false;
    $('nextPlanet').textContent='للكوكب الأخير ←';
    $('planetCompletion').textContent='إذا خلصتي تتفرجين، حلمنا بالمستقبل ينتظرج ♡';
    observeVideos();
  };
  // سحب الصور بالإصبع بين التالي والسابق، باستثناء عناصر التحكم.
  let startTouch=null;
  $('storyContent').addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;startTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  $('storyContent').addEventListener('touchend',e=>{
    if(!startTouch||e.changedTouches.length!==1||isModalOpen||data.planets[activeStage].display==='videos')return;
    const dx=e.changedTouches[0].clientX-startTouch.x,dy=e.changedTouches[0].clientY-startTouch.y;startTouch=null;
    if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)movePhoto(dx>0?1:-1);
  },{passive:true});
  $('helpButton').addEventListener('click',()=>ping('اسحبي الصور يمين ويسار، واضغطي على النجوم للرسائل. الكوكب التالي ينفتح من تخلصين كل الذكريات ♡'));
  // نافذة الصور والفيديوهات مع تكبير بإصبعين وتحريك.
  const modal=$('mediaModal'),modalWrap=$('modalMediaWrap');
  let zoom=1,offX=0,offY=0,points=new Map(),lastDistance=0,lastMid=null;
  const transformImg=()=>{const img=modalWrap.querySelector('img');if(img)img.style.transform=`translate(${offX}px,${offY}px) scale(${zoom})`;};
  const resetZoom=()=>{zoom=1;offX=0;offY=0;points.clear();lastMid=null;lastDistance=0;transformImg();};
  const openBase=(label,caption)=>{
    previousFocus=document.activeElement;
    isModalOpen=true;cancelAutoTimer();
    modal.classList.remove('is-hidden');document.body.classList.add('modal-open');
    $('modalLabel').textContent=label;$('modalCaption').textContent=caption||'';
    modalWrap.replaceChildren();resetZoom();$('closeModal').focus();
    document.querySelectorAll('#storyContent video').forEach(v=>v.pause());
  };
  const openImageModal=(src,caption)=>{
    openBase('ذكرى تستاهل تكبر ♡',caption);
    const img=document.createElement('img');img.src=src;img.alt='الصورة مكبّرة';img.draggable=false;
    img.addEventListener('error',()=>img.replaceWith(placeholder(src)),{once:true});
    modalWrap.append(img);
  };
  const openVideoModal=(num,caption)=>{
    openBase('لحظة حيّة من مجرّتنا ♡',caption);
    const v=createVideo(num);v.controls=false;v.autoplay=true;v.muted=true;v.defaultMuted=true;v.preload='metadata';
    modalVideo=v;modalWrap.append(v);
    const p=v.play();if(p&&p.catch)p.catch(()=>ping('إذا الفيديو ما اشتغل تأكد من وجود MP4 أو MOV بترميز متوافق'));
  };
  const closeMedia=()=>{
    if(!isModalOpen)return;
    if(modalVideo){modalVideo.pause();modalVideo=null;}
    modal.classList.add('is-hidden');modalWrap.replaceChildren();document.body.classList.remove('modal-open');isModalOpen=false;
    if(previousFocus && previousFocus.isConnected)previousFocus.focus();
    if(currentView==='journey'){
      if(data.planets[activeStage].display==='videos'){
        document.querySelectorAll('#storyContent video').forEach(v=>{
          const r=v.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{});}
        });
      } else if(auto){if(!typingTimer)scheduleNext();}
    }
  };
  $('closeModal').addEventListener('click',closeMedia);$('modalBackdrop').addEventListener('click',closeMedia);
  modalWrap.addEventListener('wheel',e=>{if(!modalWrap.querySelector('img'))return;e.preventDefault();zoom=Math.max(1,Math.min(6,zoom*(e.deltaY>0?.88:1.12)));if(zoom===1){offX=offY=0;}transformImg();},{passive:false});
  modalWrap.addEventListener('dblclick',resetZoom);
  modalWrap.addEventListener('pointerdown',e=>{if(!modalWrap.querySelector('img'))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});try{modalWrap.setPointerCapture(e.pointerId)}catch(_){}});
  modalWrap.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId)||!modalWrap.querySelector('img'))return;
    const previous=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===1 && zoom>1){offX+=e.clientX-previous.x;offY+=e.clientY-previous.y;transformImg();}
    if(points.size===2){const [a,b]=[...points.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance){zoom=Math.max(1,Math.min(6,zoom*(dist/lastDistance)));if(zoom===1){offX=offY=0;}transformImg();}lastDistance=dist;}
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>modalWrap.addEventListener(ev,e=>{points.delete(e.pointerId);lastDistance=0;}));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&isModalOpen)closeMedia();
    else if(!isModalOpen&&currentView==='journey'&&document.activeElement?.tagName!=='INPUT'){
      if(e.key==='ArrowLeft')movePhoto(1);if(e.key==='ArrowRight')movePhoto(-1);
    }
  });
  const renderFinale=()=>{
    closeMedia();cancelTyping();cancelAutoTimer();auto=false;
    state.stage=6;state.index=1;state.finished=true;state.started=true;save();
    display('finale');
    $('futureLead').textContent=data.futureLead;$('futureStory').textContent=data.futureStory;
    const f=$('futureImages');f.replaceChildren();
    const p=data.planets[6];for(let i=0;i<2;i++){
      const btn=document.createElement('button');btn.type='button';btn.setAttribute('aria-label',`تكبير صورة المستقبل ${i+1}`);
      btn.append(makeImg(imagePath(p,i),`صورة المستقبل ${i+1}`));
      btn.addEventListener('click',()=>openImageModal(imagePath(p,i),p.captions[i]));f.append(btn);
    }
    $('promiseLetter').classList.add('is-hidden');$('starlitNames').classList.add('is-hidden');$('lastLetter').classList.add('is-hidden');$('endActions').classList.add('is-hidden');$('favoritesPanel').classList.add('is-hidden');
    $('promiseButton').disabled=false;
    $('promiseButton').textContent='افتحي وعدي إلج ✨';
    $('lastLetterBody').textContent=data.finalLetter;
    window.scrollTo({top:0,behavior:'instant'});
  };
  $('promiseButton').addEventListener('click',()=>{
    $('promiseLetter').textContent=data.promise;$('promiseLetter').classList.remove('is-hidden');$('promiseButton').disabled=true;$('promiseButton').textContent='الوعد صار بين إيدج ♡';
    setTimeout(()=>{$('starlitNames').classList.remove('is-hidden');$('lastLetter').classList.remove('is-hidden');$('endActions').classList.remove('is-hidden');},reduced?0:900);
  });
  $('replayButton').addEventListener('click',()=>{state={...emptyProgress(),favorites:state.favorites};save();enterOpening();});
  $('showFavorites').addEventListener('click',()=>{
    const panel=$('favoritesPanel');panel.classList.remove('is-hidden');const grid=$('favoritesGrid');grid.replaceChildren();
    if(!state.favorites.length){const p=document.createElement('p');p.textContent='بعدج ما اخترتي ذكريات مفضلة، من تعيدين الرحلة اضغطي قلب على الصور اللي تحبيها ♡';grid.append(p);}
    for(const key of state.favorites){const [stage,idx]=key.split(':').map(Number),p=data.planets[stage];if(!p||p.display==='videos'||!Number.isInteger(idx))continue;
      const card=document.createElement('button');card.type='button';card.className='favorite-card';
      card.append(makeImg(imagePath(p,idx),`ذكرى مفضلة ${idx+1}`));
      const label=document.createElement('span');label.textContent=`${p.name} · ${idx+1}`;card.append(label);
      card.addEventListener('click',()=>openImageModal(imagePath(p,idx),(p.captions||[])[idx]));grid.append(card);
    }
    panel.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
  });
  $('closeFavorites').addEventListener('click',()=>$('favoritesPanel').classList.add('is-hidden'));
  // نجوم تفاعلية صغيرة ورسالة مختلفة لكل نجمة.
  const stars=$('wishStars');
  const positions=[[9,18],[87,13],[21,30],[77,32],[6,45],[93,52],[18,71],[83,72],[9,87],[91,91],[35,9],[64,16],[42,81],[69,89],[29,52],[76,57]];
  positions.forEach(([x,y],i)=>{
    const s=document.createElement('button');s.type='button';s.className='wish-star';s.textContent=i%3===0?'✧':'✦';s.style.left=`${x}%`;s.style.top=`${y}%`;s.style.fontSize=`${i%3===0?20:13}px`;s.style.animationDelay=`${(i%5)*-.7}s`;s.setAttribute('aria-label',`النجمة السرية ${i+1}`);
    s.addEventListener('click',()=>ping(data.starNotes[i%data.starNotes.length]));stars.append(s);
  });
  // خلفية نجوم خفيفة ومتوقفة تلقائياً لمن يختار تقليل الحركة.
  const canvas=$('starCanvas'),ctx=canvas.getContext('2d');let starPoints=[],frame=null,screenWidth=0,screenHeight=0;
  const rand=(i,s)=>{const x=Math.sin(i*91.17+s*34.66)*43758.545;return x-Math.floor(x);};
  const resizeCanvas=()=>{
    screenWidth=innerWidth;screenHeight=innerHeight;
    const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(screenWidth*ratio);canvas.height=Math.round(screenHeight*ratio);ctx?.setTransform(ratio,0,0,ratio,0,0);
    starPoints=Array.from({length:Math.min(180,Math.round(screenWidth*screenHeight/3900))},(_,i)=>({x:rand(i,1)*screenWidth,y:rand(i,2)*screenHeight,r:.5+rand(i,3)*1.5,phase:rand(i,4)*Math.PI*2,speed:.25+rand(i,5)*.6}));
  };
  const drawStars=(ts=0)=>{
    if(!ctx)return;
    ctx.clearRect(0,0,screenWidth,screenHeight);
    starPoints.forEach(s=>{const alpha=reduced?.56:(.25+.48*(.5+.5*Math.sin(ts*.001*s.speed+s.phase)));ctx.beginPath();ctx.fillStyle=`rgba(255,233,255,${alpha})`;ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
    if(!reduced&&!document.hidden)frame=requestAnimationFrame(drawStars);
  };
  addEventListener('resize',()=>{resizeCanvas();if(reduced)drawStars();},{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);document.querySelectorAll('video').forEach(v=>v.pause());cancelAutoTimer();}
    else{if(!reduced)frame=requestAnimationFrame(drawStars);if(currentView==='journey'&&auto&&!typingTimer)scheduleNext();if(currentView==='journey'&&data.planets[activeStage].display==='videos'&&!isModalOpen){document.querySelectorAll('#storyContent video').forEach(v=>{const r=v.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0){const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{});}});}}
  });
  resizeCanvas();drawStars();display('gate');
})();
