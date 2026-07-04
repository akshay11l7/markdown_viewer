import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import '../styles/auth.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface AuthProps {
  onLogin: (userData: { id: string; name: string; email: string; token: string }) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/signup';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      onLogin({ ...data.user, token: data.token });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('');
      setLoading(true);
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(res => res.json());

        const response = await fetch(`${API_BASE_URL}/api/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userInfo.email,
            name: userInfo.name
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Google login failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        onLogin({ ...data.user, token: data.token });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google Login Failed'),
  });

  return (
    <div className="auth-container">
      {/* Decorative Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Markdown Viewer</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Welcome back! Please enter your details.' : 'Create an account to start your journey.'}
          </p>
        </div>

        <div className="auth-tabs">
          <div 
            className="auth-tab-slider" 
            style={{ transform: isLogin ? 'translateX(0)' : 'translateX(100%)' }} 
          />
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`} 
            onClick={() => { setIsLogin(true); setError(''); }}
            type="button"
          >
            Sign In
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`} 
            onClick={() => { setIsLogin(false); setError(''); }}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{ color: '#ff7b72', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(255, 123, 114, 0.1)', padding: '8px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input 
                type="text" 
                className="auth-input" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email</label>
            <input 
              type="email" 
              className="auth-input" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input 
              type="password" 
              className="auth-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          {isLogin && (
            <span className="forgot-password">Forgot password?</span>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <div className="divider">or continue with</div>

          <button type="button" className="social-btn" onClick={() => handleGoogleLogin()} disabled={loading}>
            <svg className="google-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
};
