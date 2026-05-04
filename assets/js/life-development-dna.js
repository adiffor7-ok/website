/**
 * Life Development DNA Strand
 * Full SVG double-helix. Each year = 1 sine period (2 crossings).
 * Courses use "x.y.z" (year.semester.placement).
 * Experiences use "YYYY.M-YYYY.M" date ranges, get shaded regions
 * with duplicate rungs at start/end. Courses redistribute around them.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const VB_W = 300;
const CX = 150;
const AMP = 45;
const YEAR_H = 300;
const PAD = 30;
const DOT_R = 5;
const EXP_DOT_R = 7;
const RUNG_W = 2;
const DARKEN = 0.55;
const MIN_YEAR = 2019;
const MAX_YEAR = 2026;

const YEAR_COLORS = [
  [139, 115, 85],
  [200, 155, 40],
  [232, 168, 124],
  [220, 120, 100],
  [212, 106, 154],
  [155, 125, 212],
  [107, 163, 212],
  [80, 170, 160],
];

function isRange(str) { return String(str).includes('-'); }

function parseYear(str) {
  const start = String(str).split('-')[0].split('.');
  const year = parseInt(start[0]) || 0;
  if (isRange(str)) {
    const month = parseInt(start[1]) || 1;
    return [year, month <= 4 ? 5 : month <= 8 ? 15 : 25, 0];
  }
  return [year, (parseInt(start[1]) || 0) * 10, parseInt(start[2]) || 0];
}

function parseExpRange(str) {
  const parts = String(str).split('-');
  if (parts.length < 2) return null;
  const s = parts[0].split('.');
  const e = parts[1].split('.');
  return {
    startYear: parseInt(s[0]) || 0, startMonth: parseInt(s[1]) || 1,
    endYear: parseInt(e[0]) || 0, endMonth: parseInt(e[1]) || 12,
  };
}

function cmpYear(a, b) {
  const pa = parseYear(a.year);
  const pb = parseYear(b.year);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function rgbStr(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function hexStr(c) { return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`; }
function darken(c) { return c.map((v) => Math.round(v * DARKEN)); }

export async function initLifeDevelopmentDNA() {
  const container = document.getElementById('dna-container');
  if (!container) return;

  try {
    const res = await fetch('data/life-development.json');
    const data = await res.json();
    const items = (data.items || []).slice().sort(cmpYear).reverse();

    const layout = computeLayout(items);
    const { yPositions, yearBlocks, totalH, yearColorMap, expRungs } = layout;

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'dna-wrapper';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dna-svg');
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${totalH}`);

    addBackboneGradient(svg, yearBlocks, totalH);

    const xA = (y) => CX + AMP * Math.sin((2 * Math.PI * (y - PAD)) / YEAR_H);
    const xB = (y) => CX - AMP * Math.sin((2 * Math.PI * (y - PAD)) / YEAR_H);

    const halfP = YEAR_H / 2;
    const crossings = [];
    for (let n = 0; PAD + n * halfP <= totalH + halfP; n++) crossings.push(PAD + n * halfP);
    if (crossings[0] > 0) crossings.unshift(0);

    const gBackStrands = makeGroup(svg);
    const gShading = makeGroup(svg);
    const gRungs = makeGroup(svg);
    const gFrontStrands = makeGroup(svg);
    gFrontStrands.style.pointerEvents = 'none';
    const gDots = makeGroup(svg);
    const gLabels = makeGroup(svg);
    gLabels.style.pointerEvents = 'none';

    for (let i = 0; i < crossings.length - 1; i++) {
      const y0 = crossings[i];
      const y1 = Math.min(crossings[i + 1], totalH);
      const aFront = i % 2 === 0;
      appendStrand(gBackStrands, aFront ? xB : xA, y0, y1);
      appendStrand(gFrontStrands, aFront ? xA : xB, y0, y1);
    }

    // Draw experience shading
    items.forEach((item, idx) => {
      if (item.type === 'experience' && isRange(item.year))
        drawExpShading(gShading, item, idx, xA, xB, yearBlocks, yearColorMap, totalH);
    });

    // Draw course rungs + dots + labels
    let labelSide = 0;
    items.forEach((item, idx) => {
      if (item.type === 'experience' && isRange(item.year)) return;
      const y = yPositions[idx];
      if (y == null) return;
      const yr = parseYear(item.year)[0];
      const color = hexStr(yearColorMap.get(yr));
      drawRung(gRungs, gDots, xA, xB, y, color, false, idx);

      const name = item.courseCode || item.title;
      const onLeft = labelSide % 2 === 0;
      const ax = xA(y), bx = xB(y);
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('class', 'dna-node-label');
      lbl.setAttribute('y', y.toFixed(2));
      lbl.setAttribute('dy', '0.35em');
      if (onLeft) {
        lbl.setAttribute('x', (Math.min(ax, bx) - 10).toFixed(2));
        lbl.setAttribute('text-anchor', 'end');
      } else {
        lbl.setAttribute('x', (Math.max(ax, bx) + 10).toFixed(2));
        lbl.setAttribute('text-anchor', 'start');
      }
      lbl.setAttribute('fill', color);
      lbl.textContent = name;
      gLabels.appendChild(lbl);
      labelSide++;
    });

    // Draw experience duplicate rungs (top + bottom of each shaded region)
    expRungs.forEach(({ idx, y, useEndYear }) => {
      const range = parseExpRange(items[idx].year);
      const yr = range ? (useEndYear ? range.endYear : range.startYear) : parseYear(items[idx].year)[0];
      const baseColor = yearColorMap.get(yr);
      const darkColor = hexStr(darken(baseColor));
      drawRung(gRungs, gDots, xA, xB, y, darkColor, true, idx);
    });

    // Year labels + tick lines
    const gTicks = document.createElementNS(SVG_NS, 'g');
    svg.insertBefore(gTicks, svg.firstChild);

    const gYears = document.createElementNS(SVG_NS, 'g');
    gYears.style.pointerEvents = 'none';
    svg.appendChild(gYears);

    yearBlocks.forEach(({ year, startY, color }, i) => {
      const labelColor = i > 0 ? yearBlocks[i - 1].color : color;

      const tick = document.createElementNS(SVG_NS, 'line');
      tick.setAttribute('x1', String(CX - AMP - 25));
      tick.setAttribute('y1', startY.toFixed(2));
      tick.setAttribute('x2', String(CX - AMP));
      tick.setAttribute('y2', startY.toFixed(2));
      tick.setAttribute('stroke', rgbStr(labelColor));
      tick.setAttribute('stroke-width', '0.5');
      tick.setAttribute('stroke-opacity', '0.35');
      gTicks.appendChild(tick);

      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('class', 'dna-year-label-svg');
      lbl.setAttribute('x', String(CX - AMP - 28));
      lbl.setAttribute('y', startY.toFixed(2));
      lbl.setAttribute('dy', '0.35em');
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('fill', hexStr(labelColor));
      lbl.textContent = String(year + 1);
      gYears.appendChild(lbl);
    });

    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    const popup = document.createElement('div');
    popup.className = 'dna-popup';
    popup.id = 'dna-popup';
    popup.hidden = true;
    container.appendChild(popup);

    let activeGrps = [];
    const clearActive = () => {
      activeGrps.forEach((g) => g.classList.remove('dna-rung-active'));
      activeGrps = [];
    };
    const open = (grps, item, anchor, e) => {
      clearActive();
      activeGrps = grps;
      grps.forEach((g) => g.classList.add('dna-rung-active'));
      const fromLeft = e && e.clientX < (svg.getBoundingClientRect().left + svg.getBoundingClientRect().width / 2);
      showPopup(popup, item, anchor, svg, fromLeft);
    };
    const close = () => { clearActive(); popup.hidden = true; };

    const isRelatedToActive = (related) => {
      if (!related) return false;
      if (popup.contains(related) || popup === related) return true;
      if (related.closest) {
        if (related.closest('.dna-dot-group')) return true;
        if (related.closest('.dna-exp-shade')) return true;
      }
      return false;
    };

    svg.querySelectorAll('.dna-dot-group').forEach((grp) => {
      const item = items[parseInt(grp.dataset.index, 10)];
      grp.addEventListener('mouseenter', (e) => {
        const allGrps = [...svg.querySelectorAll(`.dna-dot-group[data-index="${grp.dataset.index}"]`)];
        open(allGrps, item, grp, e);
      });
      grp.addEventListener('mouseleave', (e) => {
        if (isRelatedToActive(e.relatedTarget)) return;
        close();
      });
      grp.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const allGrps = [...svg.querySelectorAll(`.dna-dot-group[data-index="${grp.dataset.index}"]`)];
        open(allGrps, item, grp, e);
      });
    });

    svg.querySelectorAll('.dna-exp-shade').forEach((shade) => {
      const item = items[parseInt(shade.dataset.index, 10)];
      shade.addEventListener('mouseenter', (e) => {
        const grps = [...svg.querySelectorAll(`.dna-dot-group[data-index="${shade.dataset.index}"]`)];
        const anchor = grps[0] || shade;
        open(grps, item, anchor, e);
      });
      shade.addEventListener('mouseleave', (e) => {
        if (isRelatedToActive(e.relatedTarget)) return;
        close();
      });
      shade.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const grps = [...svg.querySelectorAll(`.dna-dot-group[data-index="${shade.dataset.index}"]`)];
        const anchor = grps[0] || shade;
        open(grps, item, anchor, e);
      });
    });

    popup.addEventListener('mouseleave', (e) => {
      if (isRelatedToActive(e.relatedTarget)) return;
      close();
    });

    document.addEventListener('click', (e) => {
      if (popup.hidden) return;
      if (popup.contains(e.target)) return;
      if (e.target.closest?.('.dna-dot-group') || e.target.closest?.('.dna-exp-shade')) return;
      close();
    });
  } catch (err) {
    container.innerHTML = `<p class="dna-error">Unable to load timeline.</p>`;
  }
}

function drawRung(gRungs, gDots, xA, xB, y, color, isExp, idx) {
  const ax = xA(y), bx = xB(y);
  const leftX = Math.min(ax, bx), rightX = Math.max(ax, bx);
  const r = isExp ? EXP_DOT_R : DOT_R;

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', leftX.toFixed(2));
  line.setAttribute('y1', y.toFixed(2));
  line.setAttribute('x2', rightX.toFixed(2));
  line.setAttribute('y2', y.toFixed(2));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', isExp ? '3' : String(RUNG_W));
  gRungs.appendChild(line);

  const dotGrp = document.createElementNS(SVG_NS, 'g');
  dotGrp.setAttribute('class', `dna-dot-group${isExp ? ' dna-exp' : ''}`);
  dotGrp.dataset.index = String(idx);
  dotGrp.style.cursor = 'pointer';

  const hit = document.createElementNS(SVG_NS, 'line');
  hit.setAttribute('x1', (leftX - 6).toFixed(2));
  hit.setAttribute('y1', y.toFixed(2));
  hit.setAttribute('x2', (rightX + 6).toFixed(2));
  hit.setAttribute('y2', y.toFixed(2));
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', '14');
  dotGrp.appendChild(hit);

  const fill = color;
  addCircle(dotGrp, leftX, y, r, fill, isExp);
  addCircle(dotGrp, rightX, y, r, fill, isExp);
  gDots.appendChild(dotGrp);
}

function computeLayout(items) {
  const yearRange = [];
  for (let y = MAX_YEAR; y >= MIN_YEAR; y--) yearRange.push(y);

  const numYears = yearRange.length;
  const yearColorMap = new Map();
  const yearBlocks = [];
  let blockStart = PAD;

  yearRange.forEach((year, gi) => {
    const colorIdx = numYears <= 1 ? 0
      : Math.round(gi * (YEAR_COLORS.length - 1) / (numYears - 1));
    yearColorMap.set(year, YEAR_COLORS[colorIdx]);
    yearBlocks.push({ year, startY: blockStart, color: YEAR_COLORS[colorIdx] });
    blockStart += YEAR_H;
  });
  const totalH = blockStart + PAD;

  // Compute experience anchors (top/bottom Y from date range)
  const expAnchors = [];
  items.forEach((item, idx) => {
    if (item.type !== 'experience' || !isRange(item.year)) return;
    const range = parseExpRange(item.year);
    if (!range) return;
    const topY = dateToY(range.endYear, range.endMonth, yearBlocks);
    const botY = dateToY(range.startYear, range.startMonth, yearBlocks);
    if (topY == null || botY == null) return;
    expAnchors.push({ idx, y0: Math.min(topY, botY), y1: Math.max(topY, botY) });
  });

  // Build experience rung pairs (y0 = top/end, y1 = bottom/start)
  const expRungs = [];
  expAnchors.forEach(({ idx, y0, y1 }) => {
    expRungs.push({ idx, y: y0, useEndYear: true });
    expRungs.push({ idx, y: y1, useEndYear: false });
  });

  // Group courses by year
  const coursesByYear = new Map();
  items.forEach((item, idx) => {
    if (item.type === 'experience' && isRange(item.year)) return;
    const yr = parseYear(item.year)[0];
    if (!coursesByYear.has(yr)) coursesByYear.set(yr, []);
    coursesByYear.get(yr).push(idx);
  });

  // Distribute courses in free zones (outside experience regions)
  const yPositions = new Array(items.length).fill(null);

  yearBlocks.forEach(({ year, startY }) => {
    const courses = coursesByYear.get(year) || [];
    if (courses.length === 0) return;
    const blockEnd = startY + YEAR_H;

    const EXP_PAD = 15;
    const occupied = [];
    expAnchors.forEach(({ y0, y1 }) => {
      const oS = Math.max(y0 - EXP_PAD, startY);
      const oE = Math.min(y1 + EXP_PAD, blockEnd);
      if (oS < oE) occupied.push([oS, oE]);
    });
    occupied.sort((a, b) => a[0] - b[0]);

    const free = [];
    let cursor = startY;
    occupied.forEach(([oS, oE]) => {
      if (cursor < oS) free.push([cursor, oS]);
      cursor = Math.max(cursor, oE);
    });
    if (cursor < blockEnd) free.push([cursor, blockEnd]);

    const totalFree = free.reduce((sum, [a, b]) => sum + (b - a), 0);
    if (totalFree <= 0) return;

    const spacing = totalFree / (courses.length + 1);
    courses.forEach((idx, i) => {
      let offset = (i + 1) * spacing;
      for (const [fS, fE] of free) {
        const len = fE - fS;
        if (offset <= len) { yPositions[idx] = fS + offset; return; }
        offset -= len;
      }
      yPositions[idx] = free[free.length - 1][1] - 5;
    });
  });

  return { yPositions, yearBlocks, totalH, yearColorMap, expRungs };
}

function dateToY(year, month, yearBlocks) {
  const block = yearBlocks.find((b) => b.year === year);
  if (!block) return null;
  const frac = 1 - (month - 0.5) / 12;
  return block.startY + frac * YEAR_H;
}

function drawExpShading(parent, item, idx, xA, xB, yearBlocks, yearColorMap, totalH) {
  const range = parseExpRange(item.year);
  if (!range) return;
  const topY = dateToY(range.endYear, range.endMonth, yearBlocks);
  const botY = dateToY(range.startYear, range.startMonth, yearBlocks);
  if (topY == null || botY == null) return;
  const top = Math.min(topY, botY), bot = Math.max(topY, botY);

  const leftPts = [], rightPts = [];
  for (let y = top; y <= bot; y += 2) {
    const a = xA(y), b = xB(y);
    leftPts.push([Math.min(a, b), y]);
    rightPts.push([Math.max(a, b), y]);
  }
  const aF = xA(bot), bF = xB(bot);
  leftPts.push([Math.min(aF, bF), bot]);
  rightPts.push([Math.max(aF, bF), bot]);

  let d = `M${leftPts[0][0].toFixed(2)},${leftPts[0][1].toFixed(2)}`;
  for (let i = 1; i < leftPts.length; i++)
    d += ` L${leftPts[i][0].toFixed(2)},${leftPts[i][1].toFixed(2)}`;
  for (let i = rightPts.length - 1; i >= 0; i--)
    d += ` L${rightPts[i][0].toFixed(2)},${rightPts[i][1].toFixed(2)}`;
  d += ' Z';

  const gradId = `exp-shade-grad-${idx}`;
  const defs = parent.ownerSVGElement.querySelector('defs')
    || parent.ownerSVGElement.appendChild(document.createElementNS(SVG_NS, 'defs'));
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', String(totalH));
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');

  const stops = [];
  yearBlocks.forEach(({ startY, color }) => {
    stops.push({ y: startY, color });
    stops.push({ y: startY + YEAR_H, color });
  });
  stops.sort((a, b) => a.y - b.y);
  stops.forEach(({ y, color }) => {
    if (y < top - 1 || y > bot + 1) return;
    const s = document.createElementNS(SVG_NS, 'stop');
    s.setAttribute('offset', String(y / totalH));
    s.setAttribute('stop-color', rgbStr(color));
    grad.appendChild(s);
  });
  const topColor = yearColorMap.get(range.endYear) || [150, 150, 150];
  const botColor = yearColorMap.get(range.startYear) || [150, 150, 150];
  const sTop = document.createElementNS(SVG_NS, 'stop');
  sTop.setAttribute('offset', String(top / totalH));
  sTop.setAttribute('stop-color', rgbStr(topColor));
  const sBot = document.createElementNS(SVG_NS, 'stop');
  sBot.setAttribute('offset', String(bot / totalH));
  sBot.setAttribute('stop-color', rgbStr(botColor));
  grad.insertBefore(sTop, grad.firstChild);
  grad.appendChild(sBot);
  defs.appendChild(grad);

  const strokeGradId = `exp-stroke-grad-${idx}`;
  const sGrad = document.createElementNS(SVG_NS, 'linearGradient');
  sGrad.setAttribute('id', strokeGradId);
  sGrad.setAttribute('x1', '0'); sGrad.setAttribute('y1', '0');
  sGrad.setAttribute('x2', '0'); sGrad.setAttribute('y2', String(totalH));
  sGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
  const sTopD = document.createElementNS(SVG_NS, 'stop');
  sTopD.setAttribute('offset', String(top / totalH));
  sTopD.setAttribute('stop-color', rgbStr(darken(topColor)));
  const sBotD = document.createElementNS(SVG_NS, 'stop');
  sBotD.setAttribute('offset', String(bot / totalH));
  sBotD.setAttribute('stop-color', rgbStr(darken(botColor)));
  sGrad.appendChild(sTopD);
  sGrad.appendChild(sBotD);
  defs.appendChild(sGrad);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', 'dna-exp-shade');
  path.dataset.index = String(idx);
  path.setAttribute('fill', `url(#${gradId})`);
  path.setAttribute('fill-opacity', '0.32');
  path.setAttribute('stroke', `url(#${strokeGradId})`);
  path.setAttribute('stroke-width', '1');
  path.setAttribute('stroke-opacity', '0.4');
  parent.appendChild(path);
}

function addBackboneGradient(svg, yearBlocks, totalH) {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', 'backbone-grad');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', String(totalH));
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  yearBlocks.forEach(({ startY, color }) => {
    const dark = darken(color);
    [startY, startY + YEAR_H].forEach((offset) => {
      const s = document.createElementNS(SVG_NS, 'stop');
      s.setAttribute('offset', String(offset / totalH));
      s.setAttribute('stop-color', rgbStr(dark));
      grad.appendChild(s);
    });
  });
  defs.appendChild(grad);
  svg.appendChild(defs);
}

function makeGroup(p) { const g = document.createElementNS(SVG_NS, 'g'); p.appendChild(g); return g; }

function buildPathD(xFn, y0, y1) {
  const pts = [];
  for (let y = y0; y <= y1; y += 2)
    pts.push(`${pts.length === 0 ? 'M' : 'L'}${xFn(y).toFixed(2)},${y.toFixed(2)}`);
  if (y1 > y0) pts.push(`L${xFn(y1).toFixed(2)},${y1.toFixed(2)}`);
  return pts.join(' ');
}

function appendStrand(parent, xFn, y0, y1) {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', buildPathD(xFn, y0, y1));
  path.setAttribute('class', 'dna-strand');
  parent.appendChild(path);
}

function addCircle(parent, cx, cy, r, fill, isExp) {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', cx.toFixed(2));
  c.setAttribute('cy', cy.toFixed(2));
  c.setAttribute('r', String(r));
  c.setAttribute('fill', fill);
  if (isExp) {
    c.setAttribute('class', 'dna-exp-dot');
  }
  parent.appendChild(c);
}

function showPopup(popup, item, anchor, svg, fromLeft) {
  const isCourse = item.type === 'course';
  let html = '<div class="dna-popup-inner">';
  if (isCourse) {
    if (item.courseCode) html += `<p class="dna-popup-code">${esc(item.courseCode)}</p>`;
    html += `<h3 class="dna-popup-title">${esc(item.title)}</h3>`;
    if (item.description) html += `<p class="dna-popup-desc">${esc(item.description)}</p>`;
  } else {
    html += `<h3 class="dna-popup-title">${esc(item.title)}</h3>`;
    if (item.date) html += `<p class="dna-popup-date">${esc(item.date)}</p>`;
    if (item.description) html += `<p class="dna-popup-desc">${esc(item.description)}</p>`;
  }
  if (item.bullets?.length) html += `<ul class="dna-popup-bullets">${item.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  html += '</div>';
  popup.innerHTML = html;
  popup.hidden = false;
  popup.style.transform = 'none';
  requestAnimationFrame(() => {
    const popRect = popup.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const isMobile = viewW <= 768;

    if (isMobile) {
      popup.style.left = '50%';
      popup.style.right = 'auto';
      popup.style.top = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
      popup.classList.remove('dna-popup-left', 'dna-popup-right');
    } else {
      const svgRect = svg.getBoundingClientRect();
      const gap = 20;
      const placeRight = fromLeft;

      if (placeRight) {
        popup.style.left = `${svgRect.right + gap}px`;
        popup.style.right = 'auto';
      } else {
        popup.style.right = `${viewW - svgRect.left + gap}px`;
        popup.style.left = 'auto';
      }

      const topY = (viewH - popRect.height) / 2;
      popup.style.top = `${Math.max(12, topY)}px`;
      popup.style.transform = 'none';

      popup.classList.toggle('dna-popup-left', !placeRight);
      popup.classList.toggle('dna-popup-right', placeRight);
    }
  });
}

function esc(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
