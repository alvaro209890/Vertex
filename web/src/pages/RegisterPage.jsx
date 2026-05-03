import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function RegisterPage({ goToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess('Conta criada com sucesso! Faca o login.');
      setTimeout(goToLogin, 1500);
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'Este email ja esta em uso',
        'auth/invalid-email': 'Email invalido',
        'auth/weak-password': 'Senha muito fraca',
      };
      setError(messages[err.code] || 'Erro ao criar conta. Tente novamente.');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Criar Conta</h1>
        <p className="subtitle">Cadastre-se para usar o Vertex</p>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Senha (min. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit">Cadastrar</button>
        </form>

        <p className="auth-link">
          Ja tem conta?{' '}
          <button className="link-btn" onClick={goToLogin}>
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
