import React from 'react';

const CHART_COLORS = ['#00e676', '#4fc3f7', '#ffb74d', '#ba68c8', '#f06292'];

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTokens(v) {
  return number(v).toLocaleString('pt-BR');
}

function EmptyChart() {
  return <div className="empty-chart">Sem dados suficientes</div>;
}

function LineChart({
  points,
  valueKey = 'tokens',
  format = formatTokens,
  ariaLabel = 'Serie temporal',
  stroke = '#00e676',
}) {
  const safePoints = points || [];
  const max = Math.max(...safePoints.map((p) => number(p[valueKey])), 0);
  if (safePoints.length === 0 || max === 0) return <EmptyChart />;

  const width = 640;
  const height = 180;
  const pad = 18;
  const path = safePoints
    .map((p, index) => {
      const x = pad + (index / Math.max(safePoints.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - (number(p[valueKey]) / max) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <polyline points={path} fill="none" stroke={stroke} strokeWidth="3" />
        {safePoints.map((p, index) => {
          const x = pad + (index / Math.max(safePoints.length - 1, 1)) * (width - pad * 2);
          const y = height - pad - (number(p[valueKey]) / max) * (height - pad * 2);
          return (
            <circle key={p.bucket || index} cx={x} cy={y} r="3.5">
              <title>{`${p.label || p.bucket}: ${format(p[valueKey])}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="chart-axis">
        <span>{safePoints[0]?.label}</span>
        <strong>{format(max)}</strong>
        <span>{safePoints[safePoints.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function BarList({ rows, valueKey = 'tokens', labelKey = 'model', format = formatTokens }) {
  const safeRows = (rows || []).filter((row) => number(row[valueKey]) > 0);
  const max = Math.max(...safeRows.map((row) => number(row[valueKey])), 0);
  if (safeRows.length === 0 || max === 0) return <EmptyChart />;

  return (
    <div className="bar-list">
      {safeRows.map((row, index) => {
        const value = number(row[valueKey]);
        const pct = Math.max(3, (value / max) * 100);
        return (
          <div className="bar-row" key={row[labelKey] || row.key || index}>
            <div className="bar-meta">
              <span>{row[labelKey] || row.label}</span>
              <strong>{format(value)}</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${pct}%`,
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyBars({
  points,
  valueKey = 'tokens',
  format = formatTokens,
}) {
  const safePoints = points || [];
  const max = Math.max(...safePoints.map((p) => number(p[valueKey])), 0);
  if (safePoints.length === 0 || max === 0) return <EmptyChart />;

  return (
    <div className="daily-bars">
      {safePoints.map((point) => (
        <div className="daily-bar" key={point.bucket} title={`${point.label}: ${format(point[valueKey])}`}>
          <div
            className="daily-bar-fill"
            style={{ height: `${Math.max(4, (number(point[valueKey]) / max) * 100)}%` }}
          />
          <span>{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function TokenMix({ items, total }) {
  const filtered = (items || []).filter((item) => number(item.value) > 0);
  if (filtered.length === 0 || number(total) === 0) return <EmptyChart />;

  return (
    <div className="token-mix">
      {filtered.map((item, index) => {
        const pct = (number(item.value) / number(total)) * 100;
        return (
          <div className="mix-row" key={item.key}>
            <span className="mix-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span>{item.label}</span>
            <strong>{pct.toFixed(1)}%</strong>
            <em>{formatTokens(item.value)}</em>
          </div>
        );
      })}
    </div>
  );
}

export { EmptyChart, LineChart, BarList, DailyBars, TokenMix };
