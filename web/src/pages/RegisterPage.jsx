import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function RegisterPage({ onRegister, goToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('As senhas nao conferem');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess('Conta criada com sucesso! Redirecionando...');
      setTimeout(goToLogin, 1500);
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'Este email ja esta em uso',
        'auth/invalid-email': 'Email invalido',
        'auth/weak-password': 'Senha muito fraca',
      };
      setError(messages[err.code] || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">
            <span>Vertex</span>
          </div>
          <p className="auth-tagline">
            Sua IA de codigo com DeepSeek, direto do terminal.
            Criado para devs brasileiros, com preco justo.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">&#10003;</div>
              Modelos DeepSeek V4 (Flash e Pro)
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">&#10003;</div>
              Proxy local com API compatível com Anthropic
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">&#10003;</div>
              Dashboard de uso com custos em BRL
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="logo-text">Vertex</div>
            <h1>Criar Conta</h1>
            <p className="subtitle">Cadastre-se para usar o Vertex</p>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-password">Senha</label>
              <input
                id="reg-password"
                type="password"
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="input-group">
              <label htmlFor="reg-confirm">Confirmar senha</label>
              <input
                id="reg-confirm"
                type="password"
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          <div className="separator">ou</div>

          <div className="auth-footer">
            Ja tem conta?{' '}
            <button className="link-btn" onClick={goToLogin}>
              Fazer login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
