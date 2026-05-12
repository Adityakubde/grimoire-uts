import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from './api.js';
import AuthPanel from './components/AuthPanel.jsx';
import VaultApp from './components/VaultApp.jsx';
import { auth, onAuthStateChanged, signOut } from './firebaseClient.js';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const manualAuthRef = useRef(false);
  const sessionHandledUidRef = useRef('');

  const getToken = useCallback(async () => {
    if (!auth.currentUser) {
      return '';
    }

    return auth.currentUser.getIdToken();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setBooting(true);

      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        setBooting(false);
        return;
      }

      try {
        if (manualAuthRef.current || sessionHandledUidRef.current === user.uid) {
          sessionHandledUidRef.current = '';
          setFirebaseUser(user);
          setBooting(false);
          return;
        }

        const token = await user.getIdToken();
        const data = await apiRequest('/api/auth/me', { token });
        setFirebaseUser(user);
        setProfile(data.profile);
      } catch (error) {
        await signOut(auth);
        setFirebaseUser(null);
        setProfile(null);
      } finally {
        setBooting(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function handleAuthenticated(data) {
    manualAuthRef.current = false;
    sessionHandledUidRef.current = auth.currentUser?.uid || '';
    setFirebaseUser(auth.currentUser);
    setProfile(data.profile);
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        tokenProvider: getToken,
      });
    } catch (error) {
      console.warn(error.message);
    }

    await signOut(auth);
    setFirebaseUser(null);
    setProfile(null);
  }

  if (booting) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center">
          <p className="font-serif text-3xl text-on-surface mb-2">Opening the vault...</p>
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-[#b8b0c4]">
            Checking your session
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <AuthPanel
        onAuthStarting={(isStarting) => {
          manualAuthRef.current = isStarting;
        }}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <VaultApp
      getToken={getToken}
      onLogout={handleLogout}
      onProfileChange={setProfile}
      profile={profile}
    />
  );
}
