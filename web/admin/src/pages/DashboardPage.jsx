import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://vertex-api.cursar.space';

export default function DashboardPage({ token, user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers }),
        fetch(`${API_BASE}/admin/metrics`, { headers }),
      ]);
      if (!usersRes.ok) throw new Error('Erro ao carregar usuarios');
      const usersData = await usersRes.json();
      const metricsData = metricsRes.ok ? await metricsRes.json() : null;
      setUsers(usersData.users || []);
      setMetrics(metricsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleBlock(uid, currentlyBlocked) {
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${uid}/toggle-block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blocked: !currentlyBlocked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMsg(`Usuario ${currentlyBlocked ? 'desbloqueado' : 'bloqueado'} com sucesso`);
      fetchData();
    } catch (err) {
      setActionMsg(`Erro: ${err.message}`);
    }
  }

  function formatTokens(v) {
    if (!v) return '0';
    return v.toLocaleString('pt-BR');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('pt-BR');
  }

  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.blocked).length;
  const blockedUsers = users.filter(u => u.blocked).length;
  const totalTokens = users.reduce((acc, u) => {
    const models = (u.usage && u.usage.models) || {};
    return acc + Object.values(models).reduce((s, m) => s + (m.tokens || 0), 0);
  }, 0);

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Vertex <span>Admin</span></h1>
        <div className="header-right">
          <span className="user-badge">{user}</span>
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </header>

      {actionMsg && (
        <div className="action-bar">
          {actionMsg}
          <button className="action-close" onClick={() => setActionMsg('')}>×</button>
        </div>
      )}

      <div className="container">
        {loading && <div className="loading">Carregando...</div>}

        {!loading && (
          <>
            {/* Metricas */}
            <div className="metrics-row">
              <div className="metric-card">
                <div className="metric-label">Total de Usuarios</div>
                <div className="metric-value">{totalUsers}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Ativos</div>
                <div className="metric-value active">{activeUsers}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Bloqueados</div>
                <div className="metric-value blocked">{blockedUsers}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Tokens Totais</div>
                <div className="metric-value">{formatTokens(totalTokens)}</div>
              </div>
            </div>

            {/* Tabela de usuarios */}
            <div className="card">
              <h2>Usuarios</h2>
              {users.length === 0 ? (
                <p className="empty-state">Nenhum usuario cadastrado.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>UID</th>
                        <th>Cadastro</th>
                        <th>Ultimo Uso</th>
                        <th>Tokens</th>
                        <th>Status</th>
                        <th>Acao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const models = (u.usage && u.usage.models) || {};
                        const userTokens = Object.values(models).reduce((s, m) => s + (m.tokens || 0), 0);
                        const lastUsed = Object.values(models)
                          .map(m => m.lastUsed)
                          .filter(Boolean)
                          .sort()
                          .reverse()[0];
                        return (
                          <tr key={u.uid}>
                            <td className="email-cell">{u.email || '-'}</td>
                            <td className="uid-cell" title={u.uid}>{u.uid.slice(0, 12)}...</td>
                            <td>{formatDate(u.profile?.createdAt)}</td>
                            <td>{formatDate(lastUsed)}</td>
                            <td className="tokens-cell">{formatTokens(userTokens)}</td>
                            <td>
                              <span className={`status-badge ${u.blocked ? 'blocked' : 'active'}`}>
                                {u.blocked ? 'Bloqueado' : 'Ativo'}
                              </span>
                            </td>
                            <td>
                              <button
                                className={`action-btn ${u.blocked ? 'btn-unblock' : 'btn-block'}`}
                                onClick={() => toggleBlock(u.uid, u.blocked)}
                              >
                                {u.blocked ? 'Desbloquear' : 'Bloquear'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
