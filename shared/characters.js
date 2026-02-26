// Bangalore slang characters - funny enough to yell, recognizable in Mumbai
export const CHARACTERS = [
  { id: 'maccha', name: 'MACCHA', emoji: '🤙', color: '#ff6b6b' },
  { id: 'guru', name: 'GURU', emoji: '🧘', color: '#4ecdc4' },
  { id: 'boss', name: 'BOSS MAGA', emoji: '😎', color: '#ffe66d' },
  { id: 'halfcut', name: 'HALF CUTTING', emoji: '🍺', color: '#f7b731' },
  { id: 'auto', name: 'AUTO RAJA', emoji: '🛺', color: '#26de81' },
  { id: 'lite', name: 'LITE THAGO', emoji: '✌️', color: '#a55eea' },
  { id: 'saar', name: 'SAAR', emoji: '🙏', color: '#778ca3' },
  { id: 'repeat', name: 'REPEAT', emoji: '🔄', color: '#fd9644' },
  { id: 'onebytwo', name: 'ONE BY TWO', emoji: '☕', color: '#a5b1c2' },
  { id: 'lastbench', name: 'LAST BENCHER', emoji: '😴', color: '#4b6584' },
  { id: 'fulltight', name: 'FULL TIGHT', emoji: '🥴', color: '#eb3b5a' },
  { id: 'meter', name: 'METER DOWN', emoji: '📉', color: '#20bf6b' },
  { id: 'pakka', name: 'PAKKA LOCAL', emoji: '📍', color: '#fa8231' },
  { id: 'scene', name: 'SCENE ILLA', emoji: '🚫', color: '#8854d0' },
  { id: 'solid', name: 'SOLID MAGA', emoji: '💪', color: '#3867d6' },
  { id: 'cutting', name: 'CUTTING CHAI', emoji: '🫖', color: '#a55eea' },
  { id: 'bhai', name: 'BHAI LOG', emoji: '🤝', color: '#2d98da' },
  { id: 'timepass', name: 'TIMEPASS', emoji: '⏰', color: '#f7b731' },
  { id: 'adjust', name: 'ADJUST MAADI', emoji: '🤷', color: '#fc5c65' },
  { id: 'firstcopy', name: 'FIRST COPY', emoji: '👯', color: '#45aaf2' },
];

// Get random available character (not already taken)
export function getAvailableCharacters(takenIds = []) {
  return CHARACTERS.filter(c => !takenIds.includes(c.id));
}

export function getCharacterById(id) {
  return CHARACTERS.find(c => c.id === id);
}

// Generate room code - memorable, easy to say
const WORDS = ['MACCHA', 'GURU', 'SCENE', 'LITE', 'SOLID', 'PAKKA', 'TIGHT', 'CUTTING'];
export function generateRoomCode() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}-${num}`;
}
