// 게임 목록 — 새 게임을 만들면 이 배열에 한 줄만 추가하면 허브에 자동으로 카드가 생깁니다.
const GAMES = [
  {
    id: 'bubble-shooter',
    title: '방울 슈터',
    desc: '같은 색 방울 3개를 맞춰 터뜨리는 버블 슈터',
    emoji: '🫧',
    color: '#4d96ff',
    path: 'bubble-shooter/index.html',
  },
  {
    id: 'coming-soon-1',
    title: '다음 게임',
    desc: '준비 중이에요!',
    emoji: '✨',
    color: '#c780fa',
    comingSoon: true,
  },
  {
    id: 'coming-soon-2',
    title: '다음 게임',
    desc: '준비 중이에요!',
    emoji: '🎲',
    color: '#6bcb77',
    comingSoon: true,
  },
];
