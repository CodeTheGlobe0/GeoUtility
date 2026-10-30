// Round avatar with initials; the colour is picked from the name so it stays the same.
const COLORS = ['#00a76f', '#3b82f6', '#8e33ff', '#ffab00', '#ff5630', '#00b8d9', '#e91e63', '#7a4cff'];

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

export default function Avatar({ name, size = 32 }) {
  const sum = [...(name || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const color = COLORS[sum % COLORS.length];
  return (
    <span
      className="ad-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `${color}29`, color }}
    >
      {initials(name)}
    </span>
  );
}
