(() => {
  "use strict";

  const playlist = document.getElementById("playlist");
  const menu = document.getElementById("trackContextMenu");
  const startButton = document.getElementById("startPlayback");
  const playButton = document.getElementById("play");
  if (!playlist || !menu || !startButton || !playButton) return;

  let trackIndex = -1;

  const closeMenu = () => {
    menu.hidden = true;
    trackIndex = -1;
  };

  const runAction = (action, index) => {
    window.dispatchEvent(new CustomEvent("jjaimsae-track-action", {
      detail: { action, index }
    }));
  };

  startButton.addEventListener("click", () => playButton.click());

  playlist.addEventListener("contextmenu", (event) => {
    const item = event.target.closest("li:not(.empty)");
    if (!item || !playlist.contains(item)) return;
    event.preventDefault();
    trackIndex = Array.from(playlist.children).indexOf(item);
    if (trackIndex < 0) return;

    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;
    menu.querySelector("button")?.focus();
  });

  menu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || trackIndex < 0) return;
    const index = trackIndex;
    closeMenu();
    runAction(button.dataset.action, index);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target)) closeMenu();
  });
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
})();
