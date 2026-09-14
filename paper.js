// Torn-paper outlines for the folio sheets. Each sheet gets a ragged clip-path that follows its current size;
// the outline is seeded by the element id, so a given page keeps the same tear every time it is shown.
function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Walks the four edges; the paper is inset by a smoothed random depth with occasional deeper bites,
// the rim stays a little closer to the box edge so a pale fibre line shows around the tear.
export function tornOutline(width, height, seed, depth) {
  const rand = random(seed), paper = [], rim = [];
  let smooth = rand();
  const edge = (length, place) => {
    for (let s = 0; s < length; s += 3 + rand() * 8) {
      smooth = smooth * .6 + rand() * .4;
      let d = depth * (.2 + .8 * smooth);
      if (rand() < .03) d += depth * (.7 + rand() * .9);
      paper.push(place(s, d));
      rim.push(place(s, Math.max(0, d - 1.4 - rand() * 2.2)));
    }
  };
  edge(width, (s, d) => [s, d]);
  edge(height, (s, d) => [width - d, s]);
  edge(width, (s, d) => [width - s, height - d]);
  edge(height, (s, d) => [d, height - s]);
  const polygon = points => `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
  return {paper: polygon(paper), rim: polygon(rim)};
}
export function tearSheet(root, depth = 9) {
  const sheet = root.querySelector(':scope > .sheet'), rim = root.querySelector(':scope > .sheet-rim');
  if (!sheet) return;
  const seed = hash(root.id || root.className);
  let last = '';
  const apply = () => {
    const w = Math.round(sheet.offsetWidth), h = Math.round(sheet.offsetHeight), key = w + 'x' + h;
    if (!w || !h || key === last) return;
    last = key;
    const outline = tornOutline(w, h, seed, depth);
    sheet.style.clipPath = outline.paper;
    if (rim) rim.style.clipPath = outline.rim;
  };
  new ResizeObserver(apply).observe(sheet);
  apply();
}
