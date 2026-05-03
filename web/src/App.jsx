import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('login'); // 'login' | 'register' | 'dashboard'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        setPage('dashboard');
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    if (page === 'register') {
      return <RegisterPage goToLogin={() => setPage('login')} />;
    }
    return <LoginPage onLogin={() => setPage('dashboard')} goToRegister={() => setPage('register')} />;
  }

  return <DashboardPage user={user} onLogout={() => { auth.signOut(); setPage('login'); }} />;
}
