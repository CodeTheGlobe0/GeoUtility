// Small hand-made SVG charts for the admin dashboard (ported from FinanceApp).
// No chart library needed.

// Tiny bar chart used inside the stat cards
export function Sparkline({ data, color }) {
  const max = Math.max(...data.map(Math.abs)) || 1; // all zeros -> flat
  return (
    <svg className="ad-sparkline" viewBox={`0 0 ${data.length * 10} 40`} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max((Math.abs(v) / max) * 36, 2); // at least a 2px stub
        return <rect key={i} x={i * 10 + 2} y={40 - h} width="6" height={h} rx="2" fill={color} />;
      })}
    </svg>
  );
}

// Round the top of the axis up to 1, 2 or 5 x 10^n (0 -> 1, so empty charts still draw)
function niceMax(top) {
  if (top <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= top);
}

// Grouped bars per label with a y-axis grid
export function BarChart({ labels, series, height = 220 }) {
  const width = 640;
  const pad = { top: 10, right: 10, bottom: 28, left: 40 };
  const max = niceMax(Math.max(...series.flatMap((s) => s.data)));
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const groupW = plotW / labels.length;
  const barW = Math.min(14, groupW / (series.length + 1.5));
  // whole-number ticks only: counts of users can't be fractional
  const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * max)))];
  const y = (v) => pad.top + plotH - (v / max) * plotH;

  return (
    <svg className="ad-chart" viewBox={`0 0 ${width} ${height}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="ad-chart-gridline" />
          <text x={pad.left - 8} y={y(t) + 4} className="ad-chart-label" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {labels.map((label, i) => {
        const gx = pad.left + i * groupW + groupW / 2;
        const total = series.length * barW + (series.length - 1) * 4;
        return (
          <g key={label}>
            {series.map((s, j) => (
              <rect
                key={s.name}
                className="ad-chart-bar"
                x={gx - total / 2 + j * (barW + 4)}
                y={y(s.data[i])}
                width={barW}
                height={pad.top + plotH - y(s.data[i])}
                rx="3"
                fill={s.color}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <title>{`${s.name} · ${label}: ${s.data[i]}`}</title>
              </rect>
            ))}
            <text x={gx} y={height - 8} className="ad-chart-label" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut chart with total in the middle
export function Donut({ data, total, size = 168 }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const sum = data.reduce((a, d) => a + d.value, 0) || 1;
  // Each segment's length, and where it starts (sum of the segments before it)
  const lengths = data.map((d) => (d.value / sum) * c);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <svg className="ad-donut" viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="100" cy="100" r={r} fill="none" className="ad-donut-track" strokeWidth="22" />
      {data.map((d, i) =>
        lengths[i] > 0 ? (
          <circle
            key={d.label}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="22"
            strokeDasharray={`${Math.max(lengths[i] - 3, 1)} ${c - lengths[i] + 3}`}
            strokeDashoffset={-starts[i]}
            transform="rotate(-90 100 100)"
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </circle>
        ) : null
      )}
      <text x="100" y="94" textAnchor="middle" className="ad-donut-caption">
        Total
      </text>
      <text x="100" y="118" textAnchor="middle" className="ad-donut-total">
        {total}
      </text>
    </svg>
  );
}
