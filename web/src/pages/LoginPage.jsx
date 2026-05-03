import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginPage({ onLogin, goToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'Usuario nao encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-credential': 'Email ou senha invalidos',
        'auth/invalid-email': 'Email invalido',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      };
      setError(messages[err.code] || 'Erro ao fazer login. Verifique seus dados.');
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
            <h1>Entrar</h1>
            <p className="subtitle">Acesse sua conta para continuar</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="separator">ou</div>

          <div className="auth-footer">
            Nao tem conta?{' '}
            <button className="link-btn" onClick={goToRegister}>
              Cadastre-se
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
