// Stream the score on demand; the tour never waits for music to download.
export function initMusic(audio, button, announce) {
  let enabled = false, fadeFrame = 0, revision = 0;
  audio.volume = 0;
  function paint() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', `${enabled ? 'Wyłącz' : 'Włącz'} muzykę`);
    button.title = `Castello della Scienza · ${enabled ? 'wyłącz' : 'włącz'} muzykę`;
    button.querySelector('.sound-off').hidden = enabled;
  }
  function fade(target, pause = false) {
    cancelAnimationFrame(fadeFrame);
    const start = performance.now(), from = audio.volume;
    function step(now) {
      const t = Math.min(1, (now - start) / 650);
      audio.volume = from + (target - from) * (t * t * (3 - 2 * t));
      if (t < 1) fadeFrame = requestAnimationFrame(step);
      else if (pause) audio.pause();
    }
    fadeFrame = requestAnimationFrame(step);
  }
  async function play() {
    cancelAnimationFrame(fadeFrame);
    const ticket = ++revision;
    try {
      await audio.play();
      if (!enabled || document.hidden) { audio.pause(); audio.volume = 0; return; }
      if (ticket !== revision) return;
      fade(.48);
    } catch (error) {
      if (ticket !== revision) return;
      enabled = false; paint(); audio.pause();
      announce('Muzyka nie mogła się uruchomić. Naciśnij nutę, aby spróbować ponownie.');
    }
  }
  button.onclick = () => {
    enabled = !enabled; paint();
    if (enabled) void play();
    else { ++revision; fade(0, true); }
  };
  document.addEventListener('visibilitychange', () => {
    ++revision; cancelAnimationFrame(fadeFrame);
    if (document.hidden) { audio.pause(); audio.volume = 0; }
    else if (enabled) void play();
  });
  paint();
}
