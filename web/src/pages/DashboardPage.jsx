import React, { useState, useEffect, useCallback } from 'react';
import CommandsPage from './CommandsPage';

const API_BASE = 'https://vertex-api.cursar.space';

export default function DashboardPage({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/usage/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError('');
    } catch (err) {
      setError('Nao foi possivel carregar os dados de uso.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  function formatUSD(value) {
    return `$${value.toFixed(6)}`;
  }

  function formatBRL(value) {
    return `R$${value.toFixed(2)}`;
  }

  function formatTokens(value) {
    return value.toLocaleString('pt-BR');
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Vertex Dashboard</h1>
        <div className="header-right">
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
            <div className="totals-row">
              <div className="total-card">
                <div className="total-label">Total de Tokens</div>
                <div className="total-value">{formatTokens(data.totals.tokens)}</div>
              </div>
              <div className="total-card">
                <div className="total-label">Custo Estimado (USD)</div>
                <div className="total-value usd">{formatUSD(data.totals.costUsd)}</div>
              </div>
              <div className="total-card">
                <div className="total-label">Custo Estimado (BRL)</div>
                <div className="total-value brl">{formatBRL(data.totals.costBrl)}</div>
              </div>
            </div>

            <div className="card">
              <h2>Uso por Modelo</h2>
              {data.rows.length === 0 ? (
                <p className="empty-state">Nenhum uso registrado ainda.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Modelo</th>
                        <th>Tokens</th>
                        <th>Custo (USD)</th>
                        <th>Custo (BRL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.model}>
                          <td className="model-cell">{row.model}</td>
                          <td>{formatTokens(row.tokens)}</td>
                          <td>{formatUSD(row.costUsd)}</td>
                          <td>{formatBRL(row.costBrl)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td><strong>Total</strong></td>
                        <td><strong>{formatTokens(data.totals.tokens)}</strong></td>
                        <td><strong>{formatUSD(data.totals.costUsd)}</strong></td>
                        <td><strong>{formatBRL(data.totals.costBrl)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <p className="exchange-note">
              Taxa de cambio: USD 1.00 = R$ {data.exchangeRate}
            </p>
          </>
        )}
      </div>
      )}
    </div>
  );
}
