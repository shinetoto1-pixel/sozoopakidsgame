function renderGames() {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';

  GAMES.forEach((game) => {
    const card = document.createElement(game.comingSoon ? 'div' : 'a');
    card.className = 'card' + (game.comingSoon ? ' card-disabled' : '');
    if (!game.comingSoon) card.href = game.path;

    card.style.setProperty('--card-color', game.color);
    card.innerHTML = `
      <div class="card-emoji">${game.emoji}</div>
      <div class="card-title">${game.title}</div>
      <div class="card-desc">${game.desc}</div>
    `;
    grid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', renderGames);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
