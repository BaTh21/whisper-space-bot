import { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    accessToken: localStorage.getItem('accessToken') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    user: null
  });

  const login = (tokens) => {
    // tokens should be an object with access_token and refresh_token
    if (tokens && tokens.access_token && tokens.refresh_token) {
      localStorage.setItem('accessToken', tokens.access_token);
      localStorage.setItem('refreshToken', tokens.refresh_token);
      setAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: null // user data would be fetched separately if needed
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAuth({
      accessToken: null,
      refreshToken: null,
      user: null
    });
  };

  const value = {
    auth,
    login,
    logout,
    isAuthenticated: !!auth.accessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;