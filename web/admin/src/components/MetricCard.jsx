import React from 'react';

export default function MetricCard({ label, value, detail, tone }) {
  return (
    <div className={`metric-card ${tone || ''}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${tone || ''}`}>{value}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}
