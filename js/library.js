
  const sw = [['--y', '#fff200', '主黄'], ['--y2', '#fffb8a', '浅黄 / 渐变'], ['--y-deep', '#e0c400', '深黄'], ['--pink', '#ff1a9c', '粉 · 点缀'], ['--cyan', '#19f2c8', '青 · 点缀'], ['--ink', '#111', '墨黑'], ['--grey', '#b4b4b4', '灰 · 色条']];
  document.getElementById('sw').innerHTML = sw.map(([v, c, n]) => `<div class="sw"><i style="background:${c}"></i><b>${v}</b><span>${c} · ${n}</span></div>`).join('');

  const icons = ['nozzle', 'cube', 'gear', 'spool', 'layers', 'printer', 'chip', 'pen', 'bulb', 'users', 'trophy', 'calendar', 'wrench', 'box', 'code', 'camera'];
  document.getElementById('icons').innerHTML = icons.map(n => `<div class="tile"><div class="view"><img src="assets/icons/${n}.svg" alt=""></div><div class="cap">${n}</div></div>`).join('');

  const deco = [
    ['printer', '打印机插画'], ['nozzle-big', '喷头特写'], ['cube-wire', '线框立方体'], ['layer-stack', '分层切片'],
    ['crosshair', '十字定位'], ['barcode', '条形码'], ['ruler', '刻度尺'], ['dimension', '尺寸标注'],
    ['chevrons', '箭头组'], ['arrow-corner', '角落箭头'], ['hazard', '警示条'], ['caution', '警示标签'],
    ['stamp', '圆形印章'], ['ring', '进度环'], ['status', '状态灯'], ['signal-bars', '信号格'],
    ['circuit', '电路走线'], ['honeycomb', '蜂窝填充'], ['gyroid', '波浪填充'], ['isogrid', '斜网格'], ['plus-grid', '加号阵列']
  ];
  document.getElementById('deco').innerHTML = deco.map(([n, d]) => `<div class="tile"><div class="view"><img src="assets/deco/${n}.svg" alt=""></div><div class="cap">${n}<span>${d}</span></div></div>`).join('');
