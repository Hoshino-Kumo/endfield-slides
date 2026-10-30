// Browser-only persistence and portable HTML export. No shared server-side deck.
window.ESOnline = (() => {
  const BASE = new URL('../', document.currentScript.src);
  let database;
  const db = () => database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('endfield-slides', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('本机保存不可用，请导出 HTML 备份。'));
  });
  async function load() {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const request = connection.transaction('projects').objectStore('projects').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function save(project) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put({...project, updatedAt: Date.now()}, 'current');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error('保存失败，请导出 HTML 备份。'));
      transaction.onabort = () => reject(new Error('本机空间不足，请导出 HTML 备份。'));
    });
  }
  const readFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取图片'));
    reader.readAsDataURL(file);
  });
  async function image(file) {
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error('请选择 PNG、JPG、WebP、GIF 或 SVG 图片。');
    if (file.size > 20 * 1024 * 1024) throw new Error('单张图片请控制在 20 MB 以内。');
    return readFile(file);
  }
  const cache = new Map();
  async function asset(source) {
    if (source.startsWith('data:image/')) return source;
    const url = new URL(source, BASE);
    if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) throw new Error('无法打包外部图片，请重新上传该图片。');
    if (!cache.has(url.href)) cache.set(url.href, fetch(url).then(async response => {
      if (!response.ok) throw new Error('素材加载失败，请重试。');
      return readFile(await response.blob());
    }).catch(error => { cache.delete(url.href); throw error; }));
    return cache.get(url.href);
  }
  async function textFile(path) {
    const response = await fetch(new URL(path, BASE));
    if (!response.ok) throw new Error('无法加载放映文件，请重试。');
    return response.text();
  }
  async function portable(html, title) {
    const documentCopy = new DOMParser().parseFromString('<!doctype html><html><body>' + html, 'text/html');
    const [theme, animation, player, logo] = await Promise.all([textFile('css/theme.css'), textFile('css/anim.css'), textFile('js/slides.js'), asset('img/logo.svg')]);
    await Promise.all([...documentCopy.querySelectorAll('img')].map(async img => {
      const src = img.getAttribute('src');
      if (!src) return;
      if (/assets\/deco\/(printer|status)\.svg$/.test(src)) {
        img.dataset.liveSrc = await asset(src.replace(/\.svg$/, '-live.svg'));
        img.dataset.staticSrc = await asset(src);
      }
      img.src = await asset(src);
    }));
    const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeTitle = escape(title || 'Endfield Slides 幻灯片');
    return new Blob([`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${theme}\n${animation}</style></head><body data-logo="${logo}"><div class="toolbar"><span><b>${safeTitle}</b>← → 翻页 · Esc 退出</span><button id="play">▶ 放映 (F)</button></div>\n<!-- SLIDES:BEGIN -->\n${documentCopy.body.innerHTML}\n<!-- SLIDES:END -->\n<script>${player.replace(/<\/script/gi, '<\\/script')}</script></body></html>`], {type:'text/html;charset=utf-8'});
  }
  // Imported files contribute slide content only; never their scripts or event handlers.
  function parseImport(source) {
    if (!source.includes('<!-- SLIDES:BEGIN -->') || !source.includes('<!-- SLIDES:END -->')) throw new Error('请选择由此工具导出的 HTML 幻灯片。');
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const content = source.slice(source.indexOf('<!-- SLIDES:BEGIN -->') + 21, source.indexOf('<!-- SLIDES:END -->'));
    const parsed = new DOMParser().parseFromString(content, 'text/html');
    const allowed = new Set('SECTION DIV IMG SPAN SMALL B EM I H1 H2 H3 P OL UL LI FIGURE FIGCAPTION ASIDE STRONG U BR SUB SUP'.split(' '));
    for (const el of parsed.querySelectorAll('*')) {
      if (['HTML','HEAD','BODY'].includes(el.tagName)) continue;
      if (!allowed.has(el.tagName)) { el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        if (!['class','style','src','alt','data-transition','data-anim','data-live-src','data-static-src'].includes(attr.name)) el.removeAttribute(attr.name);
      }
      if (/url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:/i.test(el.getAttribute('style') || '')) el.removeAttribute('style');
      for (const key of ['src','data-live-src','data-static-src']) {
        const value = el.getAttribute(key);
        if (!value) continue;
        const embedded = /^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/i.test(value);
        const local = /^(img|assets)\/[\w\-./]+\.(png|jpe?g|webp|gif|svg)$/i.test(value) && !value.includes('..');
        if (!embedded && !local) el.removeAttribute(key);
      }
    }
    const slides = [...parsed.querySelectorAll('body > section.slide')];
    if (!slides.length || slides.length > 200) throw new Error('文件需要包含 1–200 页幻灯片。');
    return {html:slides.map(slide => slide.outerHTML).join('\n\n'), title:doc.title || '导入的幻灯片'};
  }
  const download = (blob, title) => {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = (title || 'Endfield Slides 幻灯片').replace(/[\\/:*?"<>|]/g, '_') + '.html';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return {load, save, image, portable, parseImport, download};
})();
