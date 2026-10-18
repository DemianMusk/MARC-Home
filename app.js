'use strict';
(() => {
  const cases = new Map(window.MARC_CASES.map(row => [row.id, row]));
  const $ = selector => document.querySelector(selector);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const preloaded = new Set();
  const setImage = (element, src) => {if (element.getAttribute('src') !== src) element.src = src;};
  const warmFrames = frames => frames.forEach(src => {
    if (preloaded.has(src)) return;
    preloaded.add(src);
    const image = new Image(); image.src = src;
  });
  const frameAt = (frames, progress) => frames[Math.min(frames.length - 1, Math.round(progress * (frames.length - 1)))];
  const groups = [...document.querySelectorAll('.motion-group')].map(element => {
    const group = {element, playing: !reducedMotion.matches, visible: false, elapsed: 0, images: []};
    group.images = [...element.querySelectorAll('[data-motion]')].map(image => {
      const frames = cases.get(image.dataset.motion).methods.km.frames;
      setImage(image, frames[0]); return {image, frames};
    });
    const button = element.querySelector('.motion-toggle');
    group.updateButton = () => {
      button.textContent = group.playing ? 'Pause motion Ⅱ' : 'Play motion ▶';
      button.setAttribute('aria-pressed', String(group.playing));
      button.setAttribute('aria-label', `${group.playing ? 'Pause' : 'Play'} mechanism previews`);
    };
    button.addEventListener('click', () => {group.playing = !group.playing; group.updateButton();});
    group.updateButton(); return group;
  });
  const descriptions = {
    dual_head_lamp2: {title: 'Keeping the linkage connected', description: 'As the lamp extends, its crossing links and pivots must stay connected. Compare how the generated assemblies respond to their control inputs.'}
  };
  let selected, progress = 0, comparePlaying = !reducedMotion.matches, compareVisible = false;
  function updatePlayButton() {
    $('#compare-play').textContent = comparePlaying ? 'Ⅱ' : '▶';
    $('#compare-play').setAttribute('aria-label', `${comparePlaying ? 'Pause' : 'Play'} comparison`);
    $('#compare-play').setAttribute('aria-pressed', String(comparePlaying));
  }
  function compareFrame() {
    for (const [method, selector] of [['km', '#ours-image'], ['articraft', '#baseline-image']]) setImage($(selector), frameAt(selected.methods[method].frames, progress));
    $('#motion-progress').value = Math.round(progress * 1000);
    $('#motion-value').value = `${Math.round(progress * 100)}%`;
  }
  function selectCase(id) {
    selected = cases.get(id); progress = 0;
    $('#case-title').textContent = descriptions[id].title;
    $('#case-description').textContent = descriptions[id].description;
    setImage($('#reference-image'), selected.reference);
    $('#reference-image').alt = `Input reference: ${selected.name}`;
    $('#ours-image').alt = `MARC: ${selected.name}, recorded motion`;
    $('#baseline-image').alt = `Articraft: ${selected.name}, recorded motion`;
    $('#ours-control').textContent = `Control: ${selected.methods.km.control}`;
    $('#baseline-control').textContent = `Control: ${selected.methods.articraft.control}`;
    $('#full-case').href = `supplement/index.html#baseline/${id}`;
    compareFrame(); warmFrames(selected.methods.km.frames); warmFrames(selected.methods.articraft.frames);
  }
  $('#compare-play').addEventListener('click', () => {comparePlaying = !comparePlaying; updatePlayButton();});
  $('#compare-reset').addEventListener('click', () => {progress = 0; compareFrame();});
  $('#motion-progress').addEventListener('input', event => {
    comparePlaying = false; updatePlayButton(); progress = Number(event.target.value) / 1000; compareFrame();
  });
  selectCase('dual_head_lamp2'); updatePlayButton();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const group = groups.find(item => item.element === entry.target);
      if (group) {
        group.visible = entry.isIntersecting;
        if (group.visible) group.images.forEach(item => warmFrames(item.frames));
      } else compareVisible = entry.isIntersecting;
    }), {rootMargin: '100px'});
    groups.forEach(group => observer.observe(group.element)); observer.observe($('.comparison-grid'));
  } else {
    groups.forEach(group => {group.visible = true; group.images.forEach(item => warmFrames(item.frames));}); compareVisible = true;
  }
  let last = 0;
  document.addEventListener('visibilitychange', () => {last = 0;});
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    groups.forEach(group => {group.playing = false; group.updateButton();}); comparePlaying = false; updatePlayButton();
  });
  function tick(time) {
    const elapsed = last ? Math.min(time - last, 100) : 0; last = time;
    if (!document.hidden) {
      for (const group of groups) {
        if (!group.playing || !group.visible) continue;
        const period = Number(group.element.dataset.period); group.elapsed = (group.elapsed + elapsed) % period;
        group.images.forEach(({image, frames}) => setImage(image, frameAt(frames, group.elapsed / period)));
      }
      if (comparePlaying && compareVisible) {progress = (progress + elapsed / 5500) % 1; compareFrame();}
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  $('#copy-citation').addEventListener('click', async () => {
    const value = $('#bibtex').textContent;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.cssText = 'position:fixed;opacity:0';
        document.body.append(textarea); textarea.select(); const copied = document.execCommand('copy'); textarea.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      $('#copy-status').textContent = 'BibTeX copied.';
    } catch (_) {$('#copy-status').textContent = 'Select the citation text above to copy it.';}
  });
})();
