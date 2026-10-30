// 公共装饰注入 + 放映模式 + 动画。编辑器里 <body data-mode="editor"> 只用 ES.decorate。
window.ES = (() => {
  const FOOT = 'ENDFIELD SLIDES · PRESENTATION';
  const RAIL = 'ENDFIELD SLIDES // 3D PRINTING // DESIGN / PRESENT / SHARE';

  function decorate(s, i, total) {
    s.querySelectorAll('[data-auto]').forEach(n => n.remove());
    const pad = n => String(n).padStart(2, '0');
    s.insertAdjacentHTML('afterbegin', `
      <div class="s-rail" data-auto><span>${RAIL}</span></div>
      <div class="s-grid" data-auto></div>`);
    s.insertAdjacentHTML('beforeend', `
      <div class="s-bottom" data-auto><div class="strip"><i style="background:var(--pink)"></i><i style="background:var(--cyan)"></i><i style="background:var(--y)"></i></div></div>
      <div class="s-foot" data-auto>${FOOT}</div>
      <div class="s-page" data-auto><b>${pad(i + 1)}</b> / ${pad(total)}</div>
      ${s.classList.contains('no-logo') ? '' : `<img class="s-logo" data-auto src="${document.body.dataset.logo || 'img/logo.svg'}" alt="">`}
      <div class="s-scan" data-auto></div>`);
  }

  return { decorate };
})();

if (document.body.dataset.mode !== 'editor') (() => {
  const slides = [...document.querySelectorAll('.slide')];
  slides.forEach((s, i) => ES.decorate(s, i, slides.length));

  // 入场动画顺序：按文档顺序给元素编号
  const ANIM = [
    '.head > *', '.cover .logo', '.ending .logo', '.t1', '.sub', '.title', '.toc .h', '.toc li',
    '.bars .bar', '.row > .card', '.stats > .stat', '.tl li', '.grid > .photo', '.content > .photo',
    '.text .p', '.list > li', '.note', '.big', '.qrbox', '.thanks', '.deco', '.datatag', '.hazard', '.coords', '.dots'
  ].join(',');
  slides.forEach(s => s.querySelectorAll(ANIM).forEach((el, k) => el.style.setProperty('--i', k)));

  // 带动效版本的素材，只在放映时替换
  const LIVE = /\/(printer|status)\.svg$/;
  const liveSwap = (on) => document.querySelectorAll('img.deco').forEach(img => {
    const src = img.getAttribute('src');
    if (img.dataset.liveSrc) { img.setAttribute('src', on ? img.dataset.liveSrc : img.dataset.staticSrc); return; }
    if (on && LIVE.test(src)) img.setAttribute('src', src.replace(/\.svg$/, '-live.svg'));
    if (!on && /-live\.svg$/.test(src)) img.setAttribute('src', src.replace(/-live\.svg$/, '.svg'));
  });

  const countUp = (s) => s.querySelectorAll('.stat .v').forEach(v => {
    const tn = [...v.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!tn) return;
    const orig = tn.textContent, target = parseFloat(orig.replace(/[^\d.]/g, ''));
    if (!target) return;
    const len = orig.trim().length, t0 = performance.now() + 300;
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / 1000));
      tn.textContent = p >= 1 ? orig : String(Math.round(target * (1 - Math.pow(1 - p, 3)))).padStart(len, '0');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  let cur = 0;
  const T = ['t-slide', 't-scan', 't-fade', 't-none', 'back', 'play'];
  const fit = () => document.body.style.setProperty('--s', Math.min(innerWidth / 1280, innerHeight / 720));
  const show = (n) => {
    const next = Math.max(0, Math.min(slides.length - 1, n));
    if (next === cur && slides[next].classList.contains('on')) return;
    const dir = next < cur ? -1 : 1;
    cur = next;
    const s = slides[cur];
    slides.forEach(x => x.classList.remove('on', ...T));
    s.classList.add('on');
    void s.offsetWidth;
    s.classList.add('t-' + (s.dataset.transition || 'slide'));
    if (dir < 0) s.classList.add('back');
    if (s.dataset.anim !== 'off') { s.classList.add('play'); countUp(s); }
  };
  const enter = (n) => { document.body.classList.add('present'); liveSwap(true); fit(); show(n); };
  const start = (n = 0) => { enter(n); document.documentElement.requestFullscreen?.().catch(() => {}); };
  const stop = () => {
    document.body.classList.remove('present');
    slides.forEach(x => x.classList.remove('on', ...T));
    liveSwap(false);
    if (document.fullscreenElement) document.exitFullscreen();
    slides[cur].scrollIntoView({ block: 'center' });
  };

  const jump = location.hash.match(/^#(\d+)$/);
  if (jump) { cur = -1; enter(+jump[1] - 1); }

  document.getElementById('play')?.addEventListener('click', () => { cur = -1; start(0); });
  slides.forEach((s, i) => s.addEventListener('dblclick', () => { if (!document.body.classList.contains('present')) { cur = -1; start(i); } }));
  addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !jump) stop(); });
  addEventListener('keydown', (e) => {
    const on = document.body.classList.contains('present');
    if (!on) { if (e.key === 'f' || e.key === 'F') { cur = -1; start(0); } return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) show(cur + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) show(cur - 1);
    else if (e.key === 'Escape') stop();
  });
  addEventListener('click', (e) => {
    if (document.body.classList.contains('present') && e.target.closest('.slide')) show(cur + 1);
  });
})();
