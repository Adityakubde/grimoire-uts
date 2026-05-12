import { useState } from 'react';
import { apiRequest } from '../api.js';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from '../firebaseClient.js';

export default function AuthPanel({ onAuthenticated, onAuthStarting }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    onAuthStarting(true);

    try {
      const credentials = mode === 'login'
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);

      if (mode === 'register') {
        await updateProfile(credentials.user, { displayName });
      }

      const token = await credentials.user.getIdToken();
      const data = await apiRequest('/api/auth/session', {
        method: 'POST',
        token,
        body: { displayName },
      });

      onAuthenticated(data);
    } catch (submitError) {
      onAuthStarting(false);
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-on-surface px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-md bg-[#18181f] border border-outline-variant/20 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div className="p-6 border-b border-outline-variant/10 flex items-center gap-3">
          <img alt="" className="h-9 w-9" src="/assets/grimoire-mark.svg" />
          <div>
            <h1 className="font-serif text-3xl text-on-surface">Grimoire</h1>
            <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#b8b0c4]">
              Prompt Vault
            </p>
          </div>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <h2 className="font-serif text-3xl text-on-surface mb-1">
              {mode === 'login' ? 'Enter Vault' : 'Create Account'}
            </h2>
            <p className="font-sans text-sm text-[#b8b0c4]">
              {mode === 'login'
                ? 'Sign in to manage your saved spells.'
                : 'Admin access follows the approved email list.'}
            </p>
          </div>

          {mode === 'register' && (
            <label className="block">
              <span className="block text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
                Display Name
              </span>
              <input
                className="sheet-field w-full text-primary font-sans text-sm p-3 focus:ring-0"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter name"
                required
                type="text"
                value={displayName}
              />
            </label>
          )}

          <label className="block">
            <span className="block text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
              Email
            </span>
            <input
              className="sheet-field w-full text-primary font-sans text-sm p-3 focus:ring-0"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
              Password
            </span>
            <input
              className="sheet-field w-full text-primary font-sans text-sm p-3 focus:ring-0"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
              type="password"
              value={password}
            />
          </label>

          {error && (
            <div className="border border-error/30 bg-error/10 p-3 text-sm text-error font-sans">
              {error}
            </div>
          )}

          <button
            className="w-full bg-primary-container text-on-primary-container font-bold font-sans py-4 text-sm tracking-[0.2em] uppercase transition-all shadow-lg active:scale-[0.98] disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Please Wait' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          <button
            className="w-full text-xs font-bold font-sans tracking-widest uppercase text-[#b8b0c4] hover:text-on-surface transition-colors"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            type="button"
          >
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}
          </button>
        </form>
      </section>
    </main>
  );
}
