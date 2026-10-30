(() => {
  let started = false;
  const start = project => {
    if (started || !project?.html) return;
    started = true;
    document.title = project.title || 'Endfield Slides 幻灯片';
    document.getElementById('projectTitle').textContent = document.title;
    document.getElementById('loading').remove();
    document.body.insertAdjacentHTML('beforeend', project.html);
    const script = document.createElement('script');
    script.src = 'js/slides.js'; document.body.appendChild(script);
    window.opener = null;
  };
  if (window.opener) {
    const receive = event => {
      if (event.origin !== location.origin || event.source !== window.opener || event.data?.type !== 'endfield-slides-preview') return;
      removeEventListener('message', receive); start(event.data.project);
    };
    addEventListener('message', receive);
    window.opener.postMessage({type:'endfield-slides-ready'}, location.origin);
  } else ESOnline.load().then(project => {
    if (project) start(project);
    else document.getElementById('loading').textContent = '还没有保存的作品，请先返回编辑器制作幻灯片。';
  }).catch(() => { document.getElementById('loading').textContent = '无法读取作品，请从编辑器重新打开放映。'; });
})();
