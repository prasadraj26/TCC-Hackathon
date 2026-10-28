import { createContext, useContext, useState, useEffect } from 'react';
import { isFirebaseConfigured } from '../services/firebase';
import {
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  getAuthToken,
  subscribeToAuth
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isFirebaseConfigured;

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const user = await loginWithEmail(email, password);
    setCurrentUser(user);
    return user;
  };

  const register = async (email, password, displayName, details) => {
    const user = await registerWithEmail(email, password, displayName, details);
    setCurrentUser(user);
    return user;
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const getAuthHeaders = async () => {
    const token = await getAuthToken(currentUser);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (currentUser?.uid) {
      headers['x-demo-user-id'] = currentUser.uid;
    }
    return headers;
  };

  const value = {
    currentUser,
    loading,
    isDemoMode,
    login,
    register,
    logout,
    getAuthHeaders
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
