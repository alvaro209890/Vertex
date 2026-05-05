import React from 'react';
import MetricCard from '../components/MetricCard';
import { LineChart, BarList, DailyBars, TokenMix } from '../components/ChartComponents';

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTokens(v) {
  if (!v) return '0';
  return number(v).toLocaleString('pt-BR');
}

function formatInteger(v) {
  return number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatUSD(value) {
  return `$${number(value).toFixed(6)}`;
}

function formatBRL(value) {
  return `R$ ${number(value).toFixed(4)}`;
}

function formatPercent(value) {
  return `${number(value).toFixed(1)}%`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '-';
}

export default function UserDetailModal({ user, onClose }) {
  const s = user.summary || {};
  const totals = s.totals || {};
  const analytics = s.analytics || {};
  const lastEvent = analytics.recent?.[0];
  const requests = number(totals.requests);
  const avgTokens = requests > 0 ? number(totals.tokens) / requests : 0;
  const cacheHit = number(totals.cacheReadInputTokens);
  const cacheMiss = number(totals.inputTokens);
  const cacheEligible = cacheHit + cacheMiss;
  const cacheHitRate = cacheEligible > 0 ? (cacheHit / cacheEligible) * 100 : 0;
  const balance = user.credits?.balance;
  const creditLabel = balance === -1 ? 'Ilimitado' : formatBRL(balance);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{user.email || 'Sem email'}</h2>
            <span className="modal-uid">{user.uid}</span>
            <span className={`status-badge ${user.blocked ? 'blocked' : 'active'}`}>
              {user.blocked ? 'Bloqueado' : 'Ativo'}
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-metrics">
          <MetricCard label="Tokens" value={formatTokens(totals.tokens || 0)} />
          <MetricCard label="Chamadas" value={formatInteger(requests)} />
          <MetricCard label="Media/chamada" value={formatTokens(avgTokens)} />
          <MetricCard label="Custo USD" value={formatUSD(totals.costUsd)} tone="cost" />
          <MetricCard label="Custo BRL" value={formatBRL(totals.costBrl)} tone="cost" />
          <MetricCard label="Cache hit" value={formatPercent(cacheHitRate)} tone="active" />
          <MetricCard label="Creditos" value={creditLabel} tone={balance === 0 ? 'blocked' : 'active'} />
          <MetricCard label="Pico" value={formatTokens(analytics.peakHour?.tokens || 0)} />
          <MetricCard
            label="Ultimo uso"
            value={lastEvent ? formatDate(lastEvent.timestamp) : '-'}
          />
        </div>

        <div className="charts-grid">
          <div className="chart-panel wide">
            <div className="panel-header">
              <span>Consumo por hora</span>
            </div>
            <LineChart points={analytics.hourly} ariaLabel="Tokens por hora do usuario" />
          </div>
          <div className="chart-panel wide">
            <div className="panel-header">
              <span>Custo por hora</span>
            </div>
            <LineChart
              points={analytics.hourly}
              valueKey="costBrl"
              format={formatBRL}
              ariaLabel="Custo por hora do usuario"
              stroke="#4fc3f7"
            />
          </div>
          <div className="chart-panel">
            <div className="panel-header">
              <span>Tipos de token</span>
            </div>
            <TokenMix items={analytics.tokenTypes} total={totals.tokens} />
          </div>
          <div className="chart-panel">
            <div className="panel-header">
              <span>Modelos</span>
            </div>
            <BarList rows={s.rows} />
          </div>
          <div className="chart-panel">
            <div className="panel-header">
              <span>Custo por modelo</span>
            </div>
            <BarList rows={s.rows} valueKey="costBrl" format={formatBRL} />
          </div>
          <div className="chart-panel">
            <div className="panel-header">
              <span>Consumo diario</span>
            </div>
            <DailyBars points={analytics.daily} />
          </div>
          <div className="chart-panel">
            <div className="panel-header">
              <span>Custo diario</span>
            </div>
            <DailyBars points={analytics.daily} valueKey="costBrl" format={formatBRL} />
          </div>
        </div>

        {analytics.recent?.length > 0 && (
          <div className="recent-section">
            <h3>Chamadas Recentes</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Horario</th>
                    <th>Modelo</th>
                    <th>Tokens</th>
                    <th>Entrada</th>
                    <th>Cache</th>
                    <th>Saida</th>
                    <th>Custo BRL</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recent.map((event, i) => (
                    <tr key={`${event.timestamp}-${event.model}-${i}`}>
                      <td>{formatDate(event.timestamp)}</td>
                      <td className="model-cell">{event.model}</td>
                      <td className="tokens-cell">{formatTokens(event.tokens)}</td>
                      <td className="tokens-cell">{formatTokens(event.inputTokens)}</td>
                      <td className="tokens-cell">
                        {formatTokens(number(event.cacheReadInputTokens) + number(event.cacheCreationInputTokens))}
                      </td>
                      <td className="tokens-cell">{formatTokens(event.outputTokens)}</td>
                      <td className="tokens-cell">{formatBRL(event.costBrl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
