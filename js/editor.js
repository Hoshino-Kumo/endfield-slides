(() => {
  const BEGIN = '<!-- SLIDES:BEGIN -->', END = '<!-- SLIDES:END -->';
  const LAYOUT_NAMES = { cover: '封面', section: '章节过渡', content: '图文内容', text: '普通内容', 'cards-page': '多卡片', gallery: '作品图集', data: '数据 / 时间线', ending: '结尾' };
  const DECO_LIST = [
    ['printer', '打印机'], ['nozzle-big', '喷头特写'], ['cube-wire', '线框立方'], ['layer-stack', '分层切片'],
    ['crosshair', '十字定位'], ['barcode', '条形码'], ['ruler', '刻度尺'], ['dimension', '尺寸标注'],
    ['chevrons', '箭头组'], ['arrow-corner', '角落箭头'], ['hazard', '警示条'], ['caution', '警示标签'],
    ['stamp', '圆形印章'], ['ring', '进度环'], ['status', '状态灯'], ['signal-bars', '信号格'],
    ['circuit', '电路走线'], ['honeycomb', '蜂窝'], ['gyroid', '波浪'], ['isogrid', '斜网格'], ['plus-grid', '加号阵列']
  ];
  const ICONS = ['nozzle', 'cube', 'gear', 'spool', 'layers', 'printer', 'chip', 'pen', 'bulb', 'users', 'trophy', 'calendar', 'wrench', 'box', 'code', 'camera'];
  const COMPS = [
    ['警示条', '<div class="hazard" style="width:200px"></div>'],
    ['数据标签', '<div class="datatag"><b>TAG</b><span>00 / 00</span></div>'],
    ['坐标小字', '<div class="coords">X 000.00\nY 000.00\nZ 000.00</div>'],
    ['点阵', '<div class="dots"></div>'],
    ['端点竖线', '<div class="vline" style="height:120px"></div>']
  ];
  const DECO_SEL = '.deco, .hazard, .datatag, .coords, .dots, .vline';
  const REPEAT = [
    ['.bars > .bar', '信息条'], ['.row > .card', '卡片'], ['.stats > .stat', '数据项'], ['.tl li', '时间节点'],
    ['.toc li', '目录项'], ['.list > li', '要点'], ['.grid > .photo', '图片'], ['.chips > span', '小标签']
  ];
  const INLINE = new Set(['B', 'EM', 'I', 'BR', 'SMALL', 'STRONG', 'U', 'SUB', 'SUP']);
  const POS = ['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%'];

  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const stage = $('#stage'), wrap = $('#stageWrap'), area = $('#stageArea'), fileInput = $('#fileInput');
  const canSave = true;
  const projectName = $('#projectName');
  const warn = message => { $('#warn').hidden = false; $('#warn').textContent = message; };
  const clearWarn = () => { $('#warn').hidden = true; };

  let deck = [], layouts = [], cur = 0, slide = null, scale = 1;
  let sel = null, editing = null, frame = null;
  let hist = [], hi = -1;
  let dirty = false, ver = 0, saving = false, again = false, autoT = 0, inputT = 0;

  // ---------- 读取 / 序列化 ----------
  const extract = (html) => {
    const i = html.indexOf(BEGIN), j = html.indexOf(END);
    const t = document.createElement('template');
    t.innerHTML = html.slice(i + BEGIN.length, j);
    return [...t.content.querySelectorAll('section.slide')];
  };
  const clean = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('[data-auto]').forEach(n => n.remove());
    c.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    c.querySelectorAll('.ed-sel, .ed-hover, .drop-target').forEach(n => {
      n.classList.remove('ed-sel', 'ed-hover', 'drop-target');
      if (!n.classList.length) n.removeAttribute('class');
    });
    c.classList.remove('on', 'play', 'ed-sel', 'ed-hover');
    return c.outerHTML;
  };
  const layoutKey = (html) => (html.match(/class="slide ([\w-]+)/) || [])[1] || '';
  const makeSlide = (html, i, total) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    const s = t.content.firstElementChild;
    ES.decorate(s, i, total);
    return s;
  };

  // ---------- 历史 / 保存 ----------
  const updUndo = () => { $('#undo').disabled = hi <= 0; $('#redo').disabled = hi >= hist.length - 1; };
  const snapshot = () => {
    const s = JSON.stringify({ deck, cur, title:projectName.value });
    if (hist[hi] === s) return;
    hist = hist.slice(0, hi + 1);
    hist.push(s);
    if (hist.length > 100) hist.shift();
    hi = hist.length - 1;
    updUndo();
  };
  const restore = (d) => {
    endEdit();
    const n = hi + d;
    if (n < 0 || n >= hist.length) return;
    hi = n;
    const s = JSON.parse(hist[hi]);
    projectName.value = s.title || projectName.value;
    deck = s.deck; cur = Math.min(s.cur, deck.length - 1);
    renderThumbs(); renderStage(); markDirty(); updUndo();
  };
  const status = (t, cls = '') => { const s = $('#status'); s.textContent = t; s.className = 'ed-status ' + cls; };
  const markDirty = () => {
    dirty = true; ver++;
    status('未保存', 'dirty');
    clearTimeout(autoT);
    if (canSave) autoT = setTimeout(save, 1500);
  };
  async function save() {
    if (!canSave) { status('无法保存', 'err'); return; }
    if (saving) { await new Promise(resolve => setTimeout(resolve, 50)); return save(); }
    clearTimeout(autoT);
    saving = true;
    const v = ver;
    status('保存中…', 'dirty');
    try {
      await ESOnline.save({html:deck.join('\n\n'), title:projectName.value.trim()});
      clearWarn();
      if (v === ver) { dirty = false; status('已保存到本机 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false })); }
    } catch (e) {
      console.error(e);
      status('保存失败', 'err');
      warn(e.message || '本机保存失败，请导出 HTML 备份。');
    }
    saving = false;
    if (again) { again = false; save(); }
  }
  const commit = () => {
    clearTimeout(inputT);
    if (!slide) return;
    const h = clean(slide);
    if (h === deck[cur]) return;
    deck[cur] = h;
    snapshot(); renderThumb(cur); markDirty();
  };
  const commitStructure = () => { snapshot(); renderThumbs(); renderStage(); markDirty(); };

  // ---------- 渲染 ----------
  function fit() {
    if (!slide) return;
    scale = Math.min((area.clientWidth - 60) / 1280, (area.clientHeight - 70) / 720);
    stage.style.transform = `scale(${scale})`;
    wrap.style.width = 1280 * scale + 'px';
    wrap.style.height = 720 * scale + 'px';
  }
  function renderStage() {
    editing = null; sel = null; frame = null;
    stage.innerHTML = '';
    slide = makeSlide(deck[cur], cur, deck.length);
    stage.appendChild(slide);
    fit(); renderSel(); renderPage();
    document.querySelectorAll('#thumbs > li').forEach(li => li.classList.toggle('cur', +li.dataset.i === cur));
    document.querySelector('#thumbs > li.cur')?.scrollIntoView({ block: 'nearest' });
  }
  function renderThumbs() {
    const ol = $('#thumbs');
    ol.innerHTML = '';
    deck.forEach((html, i) => {
      const li = document.createElement('li');
      li.draggable = true; li.dataset.i = i;
      if (i === cur) li.className = 'cur';
      li.innerHTML = `<span class="no">${pad(i + 1)}</span><div class="thumb"></div>
        <div class="thumb-ops"><button data-op="dup" title="复制本页">⧉</button><button data-op="del" class="ed-danger" title="删除本页">✕</button></div>`;
      li.querySelector('.thumb').appendChild(makeSlide(html, i, deck.length));
      ol.appendChild(li);
    });
  }
  function renderThumb(i) {
    const box = document.querySelector(`#thumbs > li[data-i="${i}"] .thumb`);
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(makeSlide(deck[i], i, deck.length));
  }
  function renderLayouts() {
    const list = $('#layoutList');
    list.innerHTML = '';
    layouts.forEach((html, i) => {
      const d = document.createElement('div');
      d.className = 'lay';
      d.innerHTML = `<div class="thumb"></div><p>${pad(i + 1)} · ${LAYOUT_NAMES[layoutKey(html)] || layoutKey(html)}</p>`;
      d.querySelector('.thumb').appendChild(makeSlide(html, i, layouts.length));
      d.onclick = () => { $('#layoutMenu').hidden = true; endEdit(); deck.splice(cur + 1, 0, html); cur++; commitStructure(); };
      list.appendChild(d);
    });
  }
  function renderLib(tab) {
    document.querySelectorAll('.ed-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const g = $('#lib');
    g.className = 'ed-libgrid' + (tab === 'icons' ? ' icons' : '');
    if (tab === 'deco') g.innerHTML = DECO_LIST.map(([n, d]) => `<div class="it" draggable="true" data-kind="deco" data-src="assets/deco/${n}.svg"><img src="assets/deco/${n}.svg" alt=""><span>${d}</span></div>`).join('');
    if (tab === 'icons') g.innerHTML = ICONS.map(n => `<div class="it" draggable="true" data-kind="icon" data-src="assets/icons/${n}.svg" title="${n}"><img src="assets/icons/${n}.svg" alt=""></div>`).join('');
    if (tab === 'comp') g.innerHTML = COMPS.map(([n], i) => `<div class="it" draggable="true" data-kind="comp" data-i="${i}"><b style="font-size:12px;color:#111">${n}</b></div>`).join('');
  }

  // ---------- 页面面板 ----------
  function renderPage() {
    const key = layoutKey(deck[cur]);
    const p = $('#pagePanel');
    p.innerHTML = `<h3>页面设置 <small>P.${pad(cur + 1)} · ${LAYOUT_NAMES[key] || key}</small></h3>
      <div class="ed-row"><label>翻页过渡</label><select id="pTrans">
        <option value="slide">滑入</option><option value="scan">扫描光带</option><option value="fade">淡入</option><option value="none">无</option></select></div>
      <div class="ed-row"><label>入场动画</label><input type="checkbox" id="pAnim"><span>元素依次出现</span></div>
      <div class="ed-row"><label>角标 Logo</label><input type="checkbox" id="pLogo"><span>右上角小 Logo</span></div>`;
    const tr = $('#pTrans'), an = $('#pAnim'), lg = $('#pLogo');
    tr.value = slide.dataset.transition || 'slide';
    an.checked = slide.dataset.anim !== 'off';
    lg.checked = !slide.classList.contains('no-logo');
    tr.onchange = () => { if (tr.value === 'slide') delete slide.dataset.transition; else slide.dataset.transition = tr.value; commit(); };
    an.onchange = () => { if (an.checked) delete slide.dataset.anim; else slide.dataset.anim = 'off'; commit(); };
    lg.onchange = () => { slide.classList.toggle('no-logo', !lg.checked); ES.decorate(slide, cur, deck.length); frame = null; updateFrame(); commit(); };
  }

  // ---------- 选取 ----------
  const isLeaf = (el) => {
    if (!el || el === slide || el.nodeType !== 1 || el.closest('[data-auto]')) return false;
    if (el.matches('img, figure, section') || !el.textContent.trim()) return false;
    for (const c of el.children) if (c.tagName === 'SPAN' ? c.className : !INLINE.has(c.tagName)) return false;
    return true;
  };
  const leafOf = (t) => {
    let el = t.nodeType === 3 ? t.parentElement : t, best = null;
    while (el && el !== slide) {
      if (isLeaf(el)) best = el; else if (best) break;
      el = el.parentElement;
    }
    return best;
  };
  const repeatOf = (el) => {
    for (let n = el; n && n !== slide; n = n.parentElement) {
      const r = REPEAT.find(([s]) => n.matches(s));
      if (r) return { el: n, sel: r[0], name: r[1] };
    }
    return null;
  };
  const pick = (t) => {
    if (!t || !slide || !slide.contains(t) || t.closest('[data-auto]')) return null;
    const d = t.closest(DECO_SEL);
    if (d) return { type: 'deco', el: d };
    if (t.closest('figcaption')) { const L = leafOf(t); if (L) return { type: 'text', el: L }; }
    const f = t.closest('figure.photo');
    if (f) return { type: 'image', el: f };
    const ico = t.closest('.ico');
    if (ico) return { type: 'icon', el: ico };
    if (t.matches('img.logo, .qrbox img')) return { type: 'image', el: t };
    const L = leafOf(t);
    if (L) return { type: 'text', el: L };
    const r = repeatOf(t);
    if (r) return { type: 'item', el: r.el };
    return null;
  };

  function select(p) {
    slide?.querySelectorAll('.ed-sel').forEach(n => n.classList.remove('ed-sel'));
    sel = p;
    if (p && p.type !== 'text' && p.type !== 'deco') p.el.classList.add('ed-sel');
    updateFrame(); renderSel();
  }
  function updateFrame() {
    frame?.remove(); frame = null;
    if (!sel || sel.type !== 'deco' || !slide?.contains(sel.el)) return;
    const el = sel.el;
    frame = document.createElement('div');
    frame.className = 'ed-frame'; frame.dataset.auto = '';
    frame.innerHTML = '<i title="拖动缩放"></i>';
    Object.assign(frame.style, { left: el.offsetLeft + 'px', top: el.offsetTop + 'px', width: el.offsetWidth + 'px', height: Math.max(el.offsetHeight, 6) + 'px' });
    slide.appendChild(frame);
  }
  function startEdit(el) {
    if (editing === el) return;
    endEdit();
    el.contentEditable = 'true';
    editing = el;
  }
  function endEdit(doCommit = true) {
    if (!editing) return;
    editing.removeAttribute('contenteditable');
    editing = null;
    getSelection().removeAllRanges();
    if (doCommit) commit();
  }

  // ---------- 拖动 / 缩放装饰 ----------
  const freeze = (el) => {
    el.style.left = el.offsetLeft + 'px'; el.style.top = el.offsetTop + 'px';
    el.style.right = ''; el.style.bottom = '';
  };
  function startDrag(e, el) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    let moved = false;
    const mv = (ev) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      el.style.left = Math.round(ox + dx) + 'px'; el.style.top = Math.round(oy + dy) + 'px';
      el.style.right = ''; el.style.bottom = '';
      updateFrame();
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) commit();
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function startResize(e) {
    e.preventDefault(); e.stopPropagation();
    const el = sel.el, sx = e.clientX, w0 = el.offsetWidth;
    freeze(el);
    const mv = (ev) => { el.style.width = Math.max(8, Math.round(w0 + (ev.clientX - sx) / scale)) + 'px'; updateFrame(); };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      commit(); renderSel();
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- 素材 / 图片 ----------
  function addAsset(d, x = 640, y = 360) {
    endEdit();
    let el;
    if (d.kind === 'comp') {
      const t = document.createElement('template');
      t.innerHTML = COMPS[+d.i][1];
      el = t.content.firstElementChild;
    } else {
      el = document.createElement('img');
      el.className = 'deco'; el.alt = '';
      el.setAttribute('src', d.src);
      el.style.width = (d.kind === 'icon' ? 64 : d.kind === 'photo' ? 360 : 200) + 'px';
    }
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    slide.insertBefore(el, slide.querySelector(':scope > .s-bottom'));
    const place = () => {
      el.style.left = Math.round(x - el.offsetWidth / 2) + 'px';
      el.style.top = Math.round(y - el.offsetHeight / 2) + 'px';
      updateFrame(); commit(); renderSel();
    };
    if (el.tagName === 'IMG') {
      el.addEventListener('load', () => {
        if (d.kind === 'deco') el.style.width = Math.min(el.naturalWidth || 200, 360) + 'px';
        place();
      }, { once: true });
    } else requestAnimationFrame(place);
    select({ type: 'deco', el });
  }
  async function upload(file) {
    if (!canSave) { alert('请通过本地网页服务打开编辑器后再添加图片。'); return null; }
    status('读取图片…', 'dirty');
    try {
      return await ESOnline.image(file);
    } catch (e) {
      alert('图片读取失败：' + e.message);
      status('图片读取失败', 'err');
      return null;
    }
  }
  function applyImage(el, path) {
    if (el.matches('figure.photo')) {
      let img = el.querySelector(':scope > img');
      if (!img) {
        el.querySelector(':scope > span')?.remove();
        img = document.createElement('img');
        img.alt = '';
        el.prepend(img);
        el.classList.remove('ph');
      }
      img.setAttribute('src', path);
    } else el.setAttribute('src', path);
    commit(); renderSel();
  }
  const imageAt = (cx, cy) => {
    const el = document.elementFromPoint(cx, cy);
    if (!el || !slide.contains(el)) return null;
    return el.closest('figure.photo') || (el.matches('img.logo, .qrbox img') ? el : null);
  };

  // ---------- 选中元素面板 ----------
  function renderSel() {
    const p = $('#selPanel');
    if (!sel || !slide?.contains(sel.el)) { p.hidden = true; return; }
    p.hidden = false;
    const el = sel.el, item = repeatOf(el);
    let h = '';
    if (sel.type === 'text') h += `<h3>文字</h3>
      <div class="ed-btns"><button data-act="bold"><b>B</b> 加粗</button><button data-act="em">黄色高亮</button><button data-act="plain">清除格式</button></div>
      <p class="ed-hint">先选中一段文字再点按钮。Enter 完成，Shift+Enter 换行，Esc 退出。</p>`;
    if (sel.type === 'image') {
      const fig = el.matches('figure.photo'), img = fig ? el.querySelector(':scope > img') : el;
      h += `<h3>图片</h3><div class="ed-btns"><button data-act="img-pick" class="ed-primary">选择图片…</button>${fig && img ? '<button data-act="img-ph">恢复占位框</button>' : ''}</div>`;
      if (fig && img) {
        const pos = img.style.objectPosition || '50% 50%';
        h += `<div class="ed-sub">裁切位置</div><div class="ed-pos">${POS.map(v => `<button data-act="pos" data-v="${v}" class="${v === pos ? 'on' : ''}">●</button>`).join('')}</div>
          <div class="ed-row" style="margin-top:10px"><label>填充方式</label><select data-in="fit"><option value="cover">铺满裁切</option><option value="contain"${img.style.objectFit === 'contain' ? ' selected' : ''}>完整显示</option></select></div>`;
      }
      h += '<p class="ed-hint">也可以直接把图片文件拖到图片框上。</p>';
    }
    if (sel.type === 'icon') {
      const src = el.querySelector('img')?.getAttribute('src') || '';
      h += `<h3>图标</h3><div class="ed-iconpick">${ICONS.map(n => `<button data-act="icon" data-v="${n}" class="${src.endsWith('/' + n + '.svg') ? 'on' : ''}" title="${n}"><img src="assets/icons/${n}.svg" alt=""></button>`).join('')}</div>`;
    }
    if (sel.type === 'deco') {
      const op = Math.round((parseFloat(el.style.opacity) || 1) * 100);
      h += `<h3>装饰元素</h3>
        <div class="ed-row"><label>宽度</label><input type="number" data-in="w" min="8" max="1600" value="${el.offsetWidth}"></div>
        <div class="ed-row"><label>透明度</label><input type="range" data-in="op" min="10" max="100" value="${op}"></div>
        <div class="ed-btns"><button data-act="d-dup">复制</button><button data-act="d-front">置顶</button><button data-act="d-back">置底</button><button data-act="d-del" class="ed-danger">删除</button></div>
        <p class="ed-hint">方向键微调（Shift 每次 10px），Delete 删除。带文字的组件双击可改字。</p>`;
    }
    if (item) {
      const hot = item.el.matches('.card, li');
      h += `<h3>条目 <small>${item.name}</small></h3>
        <div class="ed-btns"><button data-act="i-dup">＋ 复制一项</button><button data-act="i-up">↑ 上移</button><button data-act="i-down">↓ 下移</button><button data-act="i-del" class="ed-danger">删除</button></div>
        ${hot ? '<div class="ed-btns"><button data-act="i-hot">切换高亮</button></div>' : ''}`;
    }
    p.innerHTML = h;
  }

  function wrapSel(tag) {
    const s = getSelection();
    if (!editing || !s.rangeCount || s.isCollapsed || !editing.contains(s.anchorNode)) return;
    const r = s.getRangeAt(0), w = document.createElement(tag);
    w.appendChild(r.extractContents());
    r.insertNode(w);
    s.removeAllRanges();
    commit();
  }
  const siblingsOf = (item) => [...item.el.parentElement.children].filter(n => n.matches(item.sel));

  function act(a, v) {
    const el = sel?.el;
    if (!el) return;
    const item = repeatOf(el);
    const img = el.matches?.('figure.photo') ? el.querySelector(':scope > img') : el;
    switch (a) {
      case 'bold': document.execCommand('bold'); break;
      case 'em': wrapSel('em'); break;
      case 'plain':
        if (editing) { editing.querySelectorAll('b, em, strong, u').forEach(n => n.replaceWith(...n.childNodes)); commit(); }
        break;
      case 'img-pick': fileInput.click(); break;
      case 'img-ph':
        img?.remove();
        el.classList.add('ph');
        el.insertAdjacentHTML('afterbegin', '<span>IMAGE</span>');
        commit(); renderSel(); break;
      case 'pos': img.style.objectPosition = v === '50% 50%' ? '' : v; commit(); renderSel(); break;
      case 'icon': el.querySelector('img').setAttribute('src', `assets/icons/${v}.svg`); commit(); renderSel(); break;
      case 'd-dup': {
        const c = el.cloneNode(true);
        c.classList.remove('ed-sel');
        c.style.left = el.offsetLeft + 20 + 'px'; c.style.top = el.offsetTop + 20 + 'px';
        c.style.right = ''; c.style.bottom = '';
        el.after(c); commit(); select({ type: 'deco', el: c }); break;
      }
      case 'd-front': slide.insertBefore(el, slide.querySelector(':scope > .s-bottom')); updateFrame(); commit(); break;
      case 'd-back': slide.querySelector(':scope > .s-grid').after(el); updateFrame(); commit(); break;
      case 'd-del': el.remove(); select(null); commit(); break;
      case 'i-dup': {
        endEdit(false);
        const c = item.el.cloneNode(true);
        c.classList.remove('hot', 'on', 'ed-sel');
        item.el.after(c); commit(); select({ type: 'item', el: c }); break;
      }
      case 'i-del':
        if (siblingsOf(item).length <= 1) { alert('至少保留一项'); break; }
        endEdit(false); item.el.remove(); select(null); commit(); break;
      case 'i-up': case 'i-down': {
        endEdit(false);
        const sib = siblingsOf(item), k = sib.indexOf(item.el), to = sib[k + (a === 'i-up' ? -1 : 1)];
        if (!to) break;
        a === 'i-up' ? to.before(item.el) : to.after(item.el);
        commit(); select({ type: 'item', el: item.el }); break;
      }
      case 'i-hot': item.el.classList.toggle(item.el.matches('.card') ? 'hot' : 'on'); commit(); break;
    }
  }

  // ---------- 事件 ----------
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.ed-frame i')) return startResize(e);
    if (editing && editing.contains(e.target)) return;
    const p = pick(e.target);
    endEdit();
    if (!p) return select(null);
    if (p.type === 'text') { select(p); startEdit(p.el); return; }
    select(p);
    if (p.type === 'deco') startDrag(e, p.el);
  });
  stage.addEventListener('dblclick', (e) => {
    if (!e.target.closest(DECO_SEL)) return;
    const L = leafOf(e.target);
    if (!L) return;
    startEdit(L); L.focus();
    document.execCommand('selectAll');
  });
  stage.addEventListener('pointerover', (e) => {
    slide?.querySelectorAll('.ed-hover').forEach(n => n.classList.remove('ed-hover'));
    const p = pick(e.target);
    if (p && p.el !== editing && p.type !== 'deco') p.el.classList.add('ed-hover');
  });
  stage.addEventListener('pointerleave', () => slide?.querySelectorAll('.ed-hover').forEach(n => n.classList.remove('ed-hover')));
  stage.addEventListener('input', () => { clearTimeout(inputT); inputT = setTimeout(commit, 600); });
  stage.addEventListener('paste', (e) => {
    if (!editing) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  const selPanel = $('#selPanel');
  selPanel.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  selPanel.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.dataset.v); });
  selPanel.addEventListener('input', (e) => {
    const k = e.target.dataset.in, el = sel?.el;
    if (!k || !el) return;
    if (k === 'w') { freeze(el); el.style.width = Math.max(8, +e.target.value || 8) + 'px'; updateFrame(); }
    if (k === 'op') el.style.opacity = +e.target.value >= 100 ? '' : +e.target.value / 100;
    if (k === 'fit') { const img = el.querySelector(':scope > img'); img.style.objectFit = e.target.value === 'cover' ? '' : e.target.value; }
    clearTimeout(inputT); inputT = setTimeout(commit, 400);
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0], target = sel?.el;
    fileInput.value = '';
    if (!f || !target) return;
    const path = await upload(f);
    if (path) applyImage(target, path);
  });

  // 页面列表：切换 / 复制 / 删除 / 拖动排序
  const thumbs = $('#thumbs');
  thumbs.addEventListener('click', (e) => {
    const li = e.target.closest('#thumbs > li');
    if (!li) return;
    const i = +li.dataset.i, op = e.target.closest('[data-op]')?.dataset.op;
    endEdit();
    if (op === 'dup') { deck.splice(i + 1, 0, deck[i]); cur = i + 1; commitStructure(); }
    else if (op === 'del') {
      if (deck.length <= 1) return alert('至少保留一页');
      if (!confirm(`删除第 ${i + 1} 页？`)) return;
      deck.splice(i, 1);
      cur = Math.min(cur > i ? cur - 1 : cur, deck.length - 1);
      commitStructure();
    } else if (i !== cur) { cur = i; renderStage(); }
  });
  const clearMarks = () => thumbs.querySelectorAll('.drop-before, .drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));
  thumbs.addEventListener('dragstart', (e) => {
    const li = e.target.closest('#thumbs > li');
    if (!li) return;
    e.dataTransfer.setData('text/mf-page', li.dataset.i);
    e.dataTransfer.effectAllowed = 'move';
  });
  thumbs.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('text/mf-page')) return;
    e.preventDefault();
    clearMarks();
    const li = e.target.closest('#thumbs > li');
    if (!li) return;
    const r = li.getBoundingClientRect();
    li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  thumbs.addEventListener('drop', (e) => {
    const li = e.target.closest('#thumbs > li'), raw = e.dataTransfer.getData('text/mf-page');
    const after = li?.classList.contains('drop-after');
    clearMarks();
    if (!li || raw === '') return;
    e.preventDefault();
    const from = +raw;
    let to = +li.dataset.i + (after ? 1 : 0);
    if (from < to) to--;
    if (to === from) return;
    endEdit();
    const [x] = deck.splice(from, 1);
    deck.splice(to, 0, x);
    cur = to;
    commitStructure();
  });
  thumbs.addEventListener('dragend', clearMarks);

  // 素材库：单击添加 / 拖进画布
  document.querySelector('.ed-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) renderLib(b.dataset.tab); });
  const lib = $('#lib');
  lib.addEventListener('click', (e) => { const it = e.target.closest('.it'); if (it) addAsset({ ...it.dataset }); });
  lib.addEventListener('dragstart', (e) => {
    const it = e.target.closest('.it');
    if (it) e.dataTransfer.setData('text/mf-asset', JSON.stringify({ ...it.dataset }));
  });

  let dropHL = null;
  const clearDrop = () => { dropHL?.classList.remove('drop-target'); dropHL = null; };
  area.addEventListener('dragover', (e) => {
    const types = [...e.dataTransfer.types];
    if (!slide || !(types.includes('text/mf-asset') || types.includes('Files'))) return;
    e.preventDefault();
    if (types.includes('Files')) {
      const t = imageAt(e.clientX, e.clientY);
      if (t !== dropHL) { clearDrop(); if (t) { t.classList.add('drop-target'); dropHL = t; } }
    }
  });
  area.addEventListener('dragleave', (e) => { if (!area.contains(e.relatedTarget)) clearDrop(); });
  area.addEventListener('drop', async (e) => {
    e.preventDefault();
    const target = dropHL;
    clearDrop();
    const r = slide.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const a = e.dataTransfer.getData('text/mf-asset');
    if (a) return addAsset(JSON.parse(a), x, y);
    const f = e.dataTransfer.files[0];
    if (!f || !f.type.startsWith('image/')) return;
    const path = await upload(f);
    if (!path) return;
    if (target) applyImage(target, path);
    else addAsset({ kind: 'photo', src: path }, x, y);
  });

  // 顶栏
  $('#undo').onclick = () => restore(-1);
  $('#redo').onclick = () => restore(1);
  $('#save').onclick = () => { endEdit(); save(); };
  $('#present').onclick = async () => {
    endEdit();
    const project = {html:deck.join('\n\n'), title:projectName.value.trim()};
    const preview = window.open('present.html#' + (cur + 1), '_blank');
    if (!preview) { warn('浏览器阻止了放映窗口，请允许弹出窗口后重试。'); return; }
    const ready = event => {
      if (event.source !== preview || event.origin !== location.origin || event.data?.type !== 'endfield-slides-ready') return;
      preview.postMessage({type:'endfield-slides-preview', project}, location.origin);
      removeEventListener('message', ready);
    };
    addEventListener('message', ready);
    setTimeout(() => removeEventListener('message', ready), 30000);
    if (dirty && canSave) await save();
  };
  $('#addPage').onclick = () => { $('#layoutMenu').hidden = !$('#layoutMenu').hidden; };
  $('#closeMenu').onclick = () => { $('#layoutMenu').hidden = true; };

  addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); endEdit(); save(); return; }
    if (editing) {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); endEdit(); select(null); }
      else if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
      return;
    }
    if (e.target.matches('input, select, textarea')) return;
    if (mod && k === 'z') { e.preventDefault(); restore(e.shiftKey ? 1 : -1); return; }
    if (mod && k === 'y') { e.preventDefault(); restore(1); return; }
    if (sel?.type === 'deco') {
      const el = sel.el, step = e.shiftKey ? 10 : 1;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (mv) {
        e.preventDefault(); freeze(el);
        el.style.left = el.offsetLeft + mv[0] + 'px'; el.style.top = el.offsetTop + mv[1] + 'px';
        updateFrame(); clearTimeout(inputT); inputT = setTimeout(commit, 400);
      } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('d-del'); }
      else if (mod && k === 'd') { e.preventDefault(); act('d-dup'); }
      return;
    }
    if (e.key === 'Escape') { select(null); $('#layoutMenu').hidden = true; }
    if (!sel && (e.key === 'PageDown' || e.key === 'ArrowDown') && cur < deck.length - 1) { e.preventDefault(); cur++; renderStage(); }
    if (!sel && (e.key === 'PageUp' || e.key === 'ArrowUp') && cur > 0) { e.preventDefault(); cur--; renderStage(); }
  });
  addEventListener('resize', fit);
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  projectName.addEventListener('input', markDirty);
  document.querySelectorAll('[data-panel]').forEach(button => button.onclick = () => { document.body.dataset.panel = button.dataset.panel; fit(); });
  $('#exportDeck').onclick = async () => {
    endEdit();
    const button = $('#exportDeck'); button.disabled = true;
    try { ESOnline.download(await ESOnline.portable(deck.join('\n\n'), projectName.value.trim()), projectName.value.trim()); }
    catch (error) { warn(error.message); }
    finally { button.disabled = false; }
  };
  $('#importDeck').onclick = () => $('#deckInput').click();
  $('#deckInput').onchange = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { warn('文件请控制在 100 MB 以内。'); return; }
    try {
      const imported = ESOnline.parseImport(await file.text());
      if (!confirm('用导入的文件替换当前作品？请先导出需要保留的内容。')) return;
      endEdit(); projectName.value = imported.title.slice(0, 80); cur = 0;
      deck = extract(BEGIN + imported.html + END).map(clean);
      clearWarn(); commitStructure();
    } catch (error) { warn(error.message); }
  };
  $('#newDeck').onclick = () => {
    if (!confirm('新建作品会替换当前内容，请先导出需要保留的作品。继续？')) return;
    endEdit(); projectName.value = '我的演示作品'; cur = 0;
    deck = [...layouts]; clearWarn(); commitStructure();
  };

  // ---------- 启动 ----------
  (async () => {
    if (!canSave) $('#warn').hidden = false;
    try {
      const [d, l] = await Promise.all(['template.html', 'layouts.html'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text())));
      let saved;
      try { saved = await ESOnline.load(); } catch (error) { warn(error.message); }
      deck = saved?.html ? extract(BEGIN + saved.html + END).map(clean) : extract(d).map(clean);
      if (saved?.title) projectName.value = saved.title;
      layouts = extract(l).map(clean);
      if (!deck.length) throw new Error('模板里没有找到幻灯片');
    } catch (e) {
      console.error(e);
      status('读取失败', 'err');
      warn('读取失败，请刷新重试。');
      return;
    }
    snapshot(); renderThumbs(); renderStage(); renderLayouts(); renderLib('deco');
    status('已加载 · 本机保存');
  })();
})();
