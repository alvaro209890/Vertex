import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vertex-api.cursar.space';

function formatBRL(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `R$ ${n.toFixed(4)}` : 'R$ 0.0000';
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '-';
}

export default function CreditModal({ user, token, onClose, onUpdate, onUnauthorized }) {
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [user.uid]);

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.uid}/credits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.history || []);
    } catch {}
  }

  async function handleSave(bal) {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.uid}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ balance: bal, note }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) throw new Error('Erro ao salvar');
      if (bal > 0) {
        setMsg(`Recarga adicionada: ${formatBRL(bal)}`);
      } else if (bal === -1) {
        setMsg('Saldo definido como ilimitado');
      } else {
        setMsg('Saldo zerado');
      }
      setNote('');
      setBalance('');
      await fetchHistory();
      if (onUpdate) onUpdate();
    } catch (err) {
      setMsg(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const currentBalance = user.credits?.balance;
  const displayBalance = currentBalance === -1 ? 'Ilimitado' : formatBRL(currentBalance);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="credit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="credit-modal-header">
          <h2>Gerenciar Creditos</h2>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="credit-user-info">
          <span className="credit-user-email">{user.email || 'Sem email'}</span>
          <span className="credit-user-uid">{user.uid}</span>
        </div>

        <div className="credit-current">
          <span className="credit-current-label">Saldo atual:</span>
          <span className={`credit-current-value ${currentBalance === 0 ? 'zero' : currentBalance === -1 ? 'unlimited' : ''}`}>
            {displayBalance}
          </span>
        </div>

        {msg && <div className="credit-msg">{msg}</div>}

        <div className="credit-form">
          <div className="credit-form-group">
            <label>Valor (BRL)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 50.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>

          <div className="credit-form-group">
            <label>Observacao</label>
            <input
              type="text"
              placeholder="Motivo da recarga..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="credit-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !balance || Number(balance) <= 0}
              onClick={() => handleSave(Number(balance))}
            >
              {loading ? 'Salvando...' : `Recarregar ${balance ? formatBRL(Number(balance)) : ''}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => handleSave(0)}
            >
              Zerar saldo
            </button>
            <button
              type="button"
              className="btn btn-unlimited"
              disabled={loading}
              onClick={() => handleSave(-1)}
            >
              Ilimitado
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div className="credit-history">
            <h3>Historico</h3>
            <div className="credit-history-list">
              {history.slice().reverse().map((entry, i) => (
                <div key={i} className="credit-history-item">
                  <div className="credit-history-top">
                    <span className="credit-history-balance">
                      {entry.balance === -1 ? 'Ilimitado' : formatBRL(entry.balance)}
                    </span>
                    {entry.amount > 0 && (
                      <span className="credit-history-amount">+{formatBRL(entry.amount)}</span>
                    )}
                    <span className="credit-history-by">por {entry.by}</span>
                    <span className="credit-history-date">{formatDate(entry.timestamp)}</span>
                  </div>
                  {entry.note && <div className="credit-history-note">{entry.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
