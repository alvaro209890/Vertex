import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vertex-api.cursar.space';

export default function LoginPage({ onLogin, sessionMessage }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao autenticar');
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-login-layout">
        <div className="admin-brand">
          <div className="admin-brand-logo">
            <img src="/vertex_logo.png" alt="Vertex Logo" />
            <span>Vertex</span>
          </div>
          <p>
            Painel operacional para acompanhar usuarios, creditos, recargas e
            custos de uso em tempo real.
          </p>
          <div className="admin-brand-features">
            <div><span>&#10003;</span> Controle de saldo por usuario</div>
            <div><span>&#10003;</span> Metricas globais de consumo</div>
            <div><span>&#10003;</span> Bloqueio e liberacao de acesso</div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-logo">
            <img src="/vertex_logo.png" alt="Vertex Logo" />
            <span>Vertex</span>
          </div>
          <h1>Painel Administrativo</h1>
          <p className="admin-subtitle">Acesso restrito</p>

          {sessionMessage && <div className="info-msg">{sessionMessage}</div>}
          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Usuario</label>
              <input
                type="text"
                placeholder="Nome de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Senha</label>
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
