import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import '../styles/auth.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface AuthProps {
  onLogin: (userData: { id: string; name: string; email: string; token: string }) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(false); // Start on Sign Up like Overleaf
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-page">
      {/* Decorative Orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />

      {/* Navbar */}
      <nav className="auth-navbar" id="auth-navbar">
        <a className="auth-logo" href="/">
          <div className="auth-logo-icon">R</div>
          <span className="auth-logo-text">Readme<span className="auth-logo-dot">.md</span></span>
        </a>
        <div className="auth-nav-links">
          <button
            className={`auth-nav-link ${isLogin ? '' : 'outline'}`}
            onClick={() => { setIsLogin(true); setError(''); }}
            type="button"
          >
            Log In
          </button>
          <button
            className={`auth-nav-link ${!isLogin ? 'primary' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
            type="button"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Tagline — centered above both boxes */}
      <section className="auth-hero" id="auth-hero">
        <h1 className="auth-tagline">
          {isLogin ? (
            <>Welcome back to <span className="highlight">Readme</span><span className="highlight-green">.md</span></>
          ) : (
            <>
              <span className="auth-tagline-code"># </span>
              Write <span className="highlight">beautifully</span>,{' '}
              <span className="highlight-green">preview</span> instantly
            </>
          )}
        </h1>
        <p className="auth-description">
          {isLogin
            ? 'Sign in to access your documents, collaborate with your team, and pick up right where you left off.'
            : (
              <>
                The modern, collaborative markdown editor that <em>anyone</em> can use.
                Write, preview, and share — all in one place.
              </>
            )}
        </p>
      </section>

      {/* Parallel Boxes: Preview Left + Auth Right */}
      <div className="auth-split" id="auth-split">
        {/* Left — Product Preview */}
        <div className="auth-split-left">
          <div className="auth-preview-wrapper">
            <div className="auth-preview-bar">
              <div className="auth-preview-dot red" />
              <div className="auth-preview-dot yellow" />
              <div className="auth-preview-dot green" />
              <div className="auth-preview-bar-tabs">
                <div className="auth-preview-tab active">Editor</div>
                <div className="auth-preview-tab">Preview</div>
              </div>
            </div>
            <img
              src="/app-preview.png"
              alt="Readme.md — Markdown editor with live preview"
              className="auth-preview-img"
              loading="lazy"
            />
          </div>
        </div>

        {/* Right — Auth Card */}
        <div className="auth-split-right">
          <div className="auth-card" id="auth-card">
            <h2 className="auth-card-title">
              {isLogin ? 'Sign in' : 'Sign up for free'}
            </h2>

            {/* Social Login Buttons */}
            <div className="auth-social-row">
              <button
                type="button"
                className="social-btn"
                onClick={() => handleGoogleLogin()}
                disabled={loading}
                id="google-login-btn"
              >
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign {isLogin ? 'in' : 'up'} with Google
              </button>
              <button
                type="button"
                className="social-btn"
                disabled={loading}
                id="github-login-btn"
              >
                <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sign {isLogin ? 'in' : 'up'} with GitHub
              </button>
            </div>

            <div className="divider">OR</div>

            {error && (
              <div className="auth-error" id="auth-error">
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} id="auth-form">
              {!isLogin && (
                <div className="input-group">
                  <label className="input-label" htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="auth-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="input-group">
                <label className="input-label" htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="auth-password">
                  {isLogin ? 'Password' : 'Create password'}
                </label>
                <div className="password-wrapper">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`auth-btn ${isLogin ? 'login-btn' : ''}`}
                disabled={loading}
                id="auth-submit-btn"
              >
                {loading && <span className="auth-spinner" />}
                {loading
                  ? 'Processing...'
                  : isLogin
                    ? 'Sign In'
                    : 'Sign up for free'
                }
              </button>
            </form>

            {!isLogin && (
              <p className="auth-footer-text">
                By registering, you agree to our{' '}
                <a href="#">terms of service</a> and{' '}
                <a href="#">privacy notice</a>.
              </p>
            )}

            <div className="auth-toggle">
              {isLogin ? (
                <>
                  Don't have an account?
                  <button type="button" onClick={() => { setIsLogin(false); setError(''); }}>
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?
                  <button type="button" onClick={() => { setIsLogin(true); setError(''); }}>
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards — Below the fold */}
      <div className="auth-features" id="auth-features">
        <div className="auth-feature-card">
          <div className="auth-feature-icon">✍️</div>
          <h3 className="auth-feature-title">Live Preview</h3>
          <p className="auth-feature-desc">
            See your markdown rendered in real-time as you type. Split-pane editing that just works.
          </p>
        </div>
        <div className="auth-feature-card">
          <div className="auth-feature-icon">🤝</div>
          <h3 className="auth-feature-title">Real-time Collab</h3>
          <p className="auth-feature-desc">
            Share a room and co-edit documents live with your team. No setup required.
          </p>
        </div>
        <div className="auth-feature-card">
          <div className="auth-feature-icon">☁️</div>
          <h3 className="auth-feature-title">Cloud Storage</h3>
          <p className="auth-feature-desc">
            Your documents are auto-saved to the cloud. Access them from any device, anytime.
          </p>
        </div>
      </div>
    </div>
  );
};
