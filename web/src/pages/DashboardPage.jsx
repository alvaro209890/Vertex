import React, { useCallback, useEffect, useRef, useState } from 'react';
import CommandsPage from './CommandsPage';
import { isSupabaseRealtimeEnabled, supabase } from '../supabase';

const API_BASE = 'https://vertex-api.cursar.space';

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUSD(value) {
  return `$${number(value).toFixed(6)}`;
}

function formatBRL(value) {
  return `R$${number(value).toFixed(4)}`;
}

function formatTokens(value) {
  return number(value).toLocaleString('pt-BR');
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <div className={`total-card ${tone || ''}`}>
      <div className="total-label">{label}</div>
      <div className={`total-value ${tone || ''}`}>{value}</div>
      {detail && <div className="total-detail">{detail}</div>}
    </div>
  );
}

export default function DashboardPage({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveMode, setLiveMode] = useState('polling');
  const fetchingRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/usage/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        throw new Error('Conta bloqueada. Fale com o suporte para reativar o acesso.');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLiveMode(json.realtime?.provider || (isSupabaseRealtimeEnabled ? 'supabase' : 'polling'));
      setError('');
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar os dados de uso.');
      console.error(err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, isSupabaseRealtimeEnabled ? 15000 : 3000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  useEffect(() => {
    if (!isSupabaseRealtimeEnabled || !supabase || !user?.uid) return undefined;

    const channel = supabase
      .channel(`consumption:${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'consumption',
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          setLiveMode('supabase');
          fetchSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSummary, user?.uid]);

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const recent = data?.analytics?.recent || [];
  const lastEvent = recent[0];
  const savings = totals.cacheSavings || {};

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Vertex Dashboard</h1>
        <div className="header-right">
          <span className={`live-badge ${liveMode}`}>
            {liveMode === 'supabase' ? 'Realtime' : 'Atualizando'}
          </span>
          <span className="user-email">{user.email}</span>
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === 'dashboard' ? 'tab-active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab ${tab === 'commands' ? 'tab-active' : ''}`}
          onClick={() => setTab('commands')}
        >
          Comandos
        </button>
      </nav>

      {tab === 'commands' && (
        <div className="container">
          <CommandsPage />
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="container">
          {loading && <div className="loading">Carregando dados...</div>}
          {error && <div className="error-msg">{error}</div>}

          {data && !loading && (
            <>
              <div className="totals-row dashboard-metrics">
                <MetricCard
                  label="Custo real USD"
                  value={formatUSD(totals.costUsd)}
                  detail="formula DeepSeek V4 Flash"
                  tone="usd"
                />
                <MetricCard
                  label="Custo real BRL"
                  value={formatBRL(totals.costBrl)}
                  detail={`USD 1 = R$ ${data.exchangeRate}`}
                  tone="brl"
                />
                <MetricCard
                  label="Economia cache"
                  value={formatUSD(savings.savingsUsd)}
                  detail={`${formatBRL(savings.savingsBrl)} poupados`}
                  tone="save"
                />
                <MetricCard
                  label="Cache miss"
                  value={formatTokens(totals.inputTokens)}
                  detail="$0.14 por 1M tokens"
                />
                <MetricCard
                  label="Cache hit"
                  value={formatTokens(totals.cacheReadInputTokens)}
                  detail="$0.0028 por 1M tokens"
                  tone="brl"
                />
                <MetricCard
                  label="Saida"
                  value={formatTokens(totals.outputTokens)}
                  detail="$0.28 por 1M tokens"
                  tone="usd"
                />
              </div>

              <div className="card">
                <h2>Uso por modelo</h2>
                {rows.length === 0 ? (
                  <p className="empty-state">Nenhum uso registrado ainda.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Modelo</th>
                          <th>Total</th>
                          <th>Cache miss</th>
                          <th>Cache hit</th>
                          <th>Saida</th>
                          <th>USD</th>
                          <th>BRL</th>
                          <th>Ultimo uso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.model}>
                            <td className="model-cell">{row.model}</td>
                            <td>{formatTokens(row.tokens)}</td>
                            <td>{formatTokens(row.inputTokens)}</td>
                            <td>{formatTokens(row.cacheReadInputTokens)}</td>
                            <td>{formatTokens(row.outputTokens)}</td>
                            <td>{formatUSD(row.costUsd)}</td>
                            <td>{formatBRL(row.costBrl)}</td>
                            <td>{formatDateTime(row.lastUsed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card recent-card">
                <h2>Chamadas recentes</h2>
                {recent.length === 0 ? (
                  <p className="empty-state">Nenhuma chamada registrada ainda.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Horario</th>
                          <th>Modelo</th>
                          <th>Total</th>
                          <th>Miss</th>
                          <th>Hit</th>
                          <th>Saida</th>
                          <th>Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((event, index) => (
                          <tr key={`${event.timestamp}-${event.requestId || index}`}>
                            <td>{formatDateTime(event.timestamp)}</td>
                            <td className="model-cell">{event.model}</td>
                            <td>{formatTokens(event.tokens)}</td>
                            <td>{formatTokens(event.inputTokens)}</td>
                            <td>{formatTokens(event.cacheReadInputTokens)}</td>
                            <td>{formatTokens(event.outputTokens)}</td>
                            <td>{formatBRL(event.costBrl)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="exchange-note">
                {data.pricingSource}
                {lastEvent ? ` Ultima atualizacao: ${formatDateTime(lastEvent.timestamp)}.` : ''}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
