import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './styles.css';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('vertexAdminToken'));
  const [user, setUser] = useState(() => localStorage.getItem('vertexAdminUser'));
  const [sessionMessage, setSessionMessage] = useState('');

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem('vertexAdminToken', nextToken);
    localStorage.setItem('vertexAdminUser', nextUser);
    setToken(nextToken);
    setUser(nextUser);
    setSessionMessage('');
  }

  function clearSession(message = '') {
    localStorage.removeItem('vertexAdminToken');
    localStorage.removeItem('vertexAdminUser');
    setToken(null);
    setUser(null);
    setSessionMessage(message);
  }

  function handleLogout() {
    clearSession();
  }

  function handleUnauthorized() {
    clearSession('Sessao admin expirada. Entre novamente para continuar.');
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} sessionMessage={sessionMessage} />;
  }

  return (
    <DashboardPage
      token={token}
      user={user}
      onLogout={handleLogout}
      onUnauthorized={handleUnauthorized}
    />
  );
}
