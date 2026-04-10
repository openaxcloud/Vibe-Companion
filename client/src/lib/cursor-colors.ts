// Predefined cursor colors for collaborative editing
export const CURSOR_COLORS = [
  { bg: '#FF6B6B', text: '#FFFFFF', name: 'red' },
  { bg: '#4ECDC4', text: '#FFFFFF', name: 'teal' },
  { bg: '#45B7D1', text: '#FFFFFF', name: 'blue' },
  { bg: '#96CEB4', text: '#FFFFFF', name: 'green' },
  { bg: '#FFEAA7', text: '#000000', name: 'yellow' },
  { bg: '#DDA0DD', text: '#FFFFFF', name: 'plum' },
  { bg: '#FF8C42', text: '#FFFFFF', name: 'orange' },
  { bg: '#6C5CE7', text: '#FFFFFF', name: 'purple' },
  { bg: '#A8E6CF', text: '#000000', name: 'mint' },
  { bg: '#FFB6C1', text: '#000000', name: 'pink' },
  { bg: '#87CEEB', text: '#000000', name: 'sky' },
  { bg: '#F0E68C', text: '#000000', name: 'khaki' },
];

// Hash function to consistently assign colors based on user ID
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getCursorColor(userId: string | number): typeof CURSOR_COLORS[0] {
  const hash = hashString(String(userId));
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

export function getCursorStyle(userId: string | number) {
  const color = getCursorColor(userId);
  return {
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.bg,
  };
}
