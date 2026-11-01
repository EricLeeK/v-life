/** Measurements only: React retains ownership of all text and heading nodes. */
export function installTextEnhancements() {
  const ownedTitles = new Set<HTMLElement>();
  const onHover = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    let text: HTMLElement | null = event.target instanceof HTMLElement ? event.target : event.target.parentElement;
    while (text && getComputedStyle(text).textOverflow !== 'ellipsis') text = text.parentElement;
    if (!text) return;
    if (text.scrollWidth > text.clientWidth) {
      if (!text.hasAttribute('title') || ownedTitles.has(text)) {
        text.title = text.textContent?.trim() || '';
        ownedTitles.add(text);
      }
    } else if (ownedTitles.has(text)) {
      text.removeAttribute('title');
      ownedTitles.delete(text);
    }
  };
  document.addEventListener('pointerover', onHover);
  document.addEventListener('focusin', onHover);
  if (typeof ResizeObserver === 'undefined') return () => {
    document.removeEventListener('pointerover', onHover); document.removeEventListener('focusin', onHover);
  };
  let frame = 0;
  const observed = new Set<Element>();
  const scan = () => {
    frame = 0;
    for (const text of ownedTitles) {
      if (!text.isConnected || text.scrollWidth <= text.clientWidth) {
        text.removeAttribute('title'); ownedTitles.delete(text);
      } else text.title = text.textContent?.trim() || '';
    }
    document.querySelectorAll<HTMLParagraphElement>('p').forEach(p => {
      const parent = p.parentElement;
      if (!parent) return;
      if (!observed.has(parent)) { resize.observe(parent); observed.add(parent); }
      const text = p.textContent || '';
      const han = text.match(/\p{Script=Han}/gu)?.length || 0;
      const style = getComputedStyle(p);
      const parentStyle = getComputedStyle(parent);
      const available = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);
      const chars = Math.min(26, Math.floor(available / parseFloat(style.fontSize)));
      const eligible = p.matches(':lang(zh)') && han >= 50 && han / text.replace(/\s/g, '').length > .5 && chars >= 15
        && !p.closest('button, figcaption, caption, code, pre, [contenteditable], .font-mono, .text-caption, .text-xs')
        && !p.matches('.truncate, [data-truncate], [class*="line-clamp"]') && !p.querySelector('img, table, code, .katex');
      if (eligible) {
        if (p.style.getPropertyValue('--zh-measure') !== `${chars}em`) p.style.setProperty('--zh-measure', `${chars}em`);
        p.setAttribute('data-zh-measure', '');
      } else if (p.hasAttribute('data-zh-measure')) {
        p.removeAttribute('data-zh-measure'); p.style.removeProperty('--zh-measure');
      }
    });
    for (const element of observed) if (!element.isConnected) { resize.unobserve(element); observed.delete(element); }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
  const resize = new ResizeObserver(schedule);
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true });
  const language = new MutationObserver(schedule);
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.fonts?.ready.then(schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect(); language.disconnect();
    document.removeEventListener('pointerover', onHover); document.removeEventListener('focusin', onHover);
  };
}
