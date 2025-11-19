import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Avatar
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';
import LogoImg from '@/assets/Login1.gif';
import {toast} from 'react-toastify';

const LoginForm = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validationSchema: Yup.object({
      username: Yup.string().email('Invalid email').required('Required'),
      password: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      setError(null);
      setLoading(true);
      try {
        const response = await loginApi({
          email: values.username,
          password: values.password
        });

        await login(response);
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || 'Login failed');
        toast.error(`Failed : ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "100vh",
        width: "100%",
      }}
    >
      {/* LEFT SIDE IMAGE */}
      <Box
        sx={{
          width: { xs: "100%", md: "40%" },
          display: 'flex',
          alignItems: { xs: 'end', md: "center" },
          justifyContent: "center",
          mt: { xs: 8, md: 0 }
        }}
      >
        <Box
          component="img"
          src={LogoImg}
          sx={{
            width: { xs: "70%", sm: 300, md: 480 },
            maxWidth: "100%",
            height: "auto",
          }}
        />
      </Box>

      {/* RIGHT SIDE FORM */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: { xs: 'start', md: "center" },
          justifyContent: "center",
          // p: { xs: 2, sm: 4 },
          backgroundColor: { xs: 'transparent', md: "grey.300" },
          height: { md: '100vh' },
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "white",
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            boxShadow: { xs: 'none', md: 5 },
          }}
        >
          <Typography
            variant="h4"
            color="primary"
            sx={{ fontWeight: 600, mb: 3 }}
          >
            SIGN IN
          </Typography>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Collapse>

          <Box component="form" onSubmit={formik.handleSubmit}>
            <TextField
              label="Email"
              name="username"
              type="email"
              fullWidth
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.username && !!formik.errors.username}
              helperText={formik.touched.username && formik.errors.username}
              margin="normal"
              required
              disabled={loading}
            />

            <TextField
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              fullWidth
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.password && !!formik.errors.password}
              helperText={formik.touched.password && formik.errors.password}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: 'center',
                mt: 1,
              }}
            >
              <Typography variant="body2">Don't have an account?</Typography>

              <Button sx={{ color: "red" }} onClick={() => navigate("/register")}>
                Create New
              </Button>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3, py: 1.5 }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>


  );
};

export default LoginForm;