import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './styles.css';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  if (!token) {
    return <LoginPage onLogin={(t, u) => { setToken(t); setUser(u); }} />;
  }

  return <DashboardPage token={token} user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}
