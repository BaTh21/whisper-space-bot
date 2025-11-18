// App.jsx
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DebugAuth from './components/DebugAuth';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import DashboardPage from './pages/DashboardPage';
import GroupChatPage from './pages/GroupChatPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyCodePage from './pages/VerifyCodePage';
import theme from './theme';
import AuthRedirect from './guards/AuthRedirect';

const App = () => (
  <ThemeProvider theme={theme}>
    <AuthProvider>
      <DebugAuth>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login"
              element={
                <AuthRedirect>
                  <LoginPage />
                </AuthRedirect>
              } />
            <Route path="/register"
              element={
                <AuthRedirect>
                  <RegisterPage />
                </AuthRedirect>
              } />
            <Route path="/verify-code/:email"
              element={
                <AuthRedirect>
                  <VerifyCodePage />
                </AuthRedirect>
              } />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="/group/:groupId"
              element={
                <ProtectedRoute>
                  <GroupChatPage />
                </ProtectedRoute>
              }
            /> */}

            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" />} />

            {/* Catch all route - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </DebugAuth>
    </AuthProvider>
  </ThemeProvider>
);

export default App;