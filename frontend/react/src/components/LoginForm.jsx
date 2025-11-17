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
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';

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
        // Pass the values directly to loginApi - it will handle the form data conversion
        const response = await loginApi({
          email: values.username, 
          password: values.password
        });
        
        if (login(response)) {
          navigate('/dashboard');
        } else {
          setError('Login failed: Invalid tokens received');
        }
      } catch (err) {
        // Use err.message instead of err.msg
        setError(err.message || 'Login failed');
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Card
      sx={{
        width: { xs: '100%', sm: '90%' },
        maxWidth: 500,
        mx: 'auto',
        p: { xs: 2, sm: 3 },
        mt: 16,
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        align="center"
        color="primary"
        sx={{ fontWeight: 600 }}
      >
        Sign In
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
          value={formik.values.username}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.username && !!formik.errors.username}
          helperText={formik.touched.username && formik.errors.username}
          fullWidth
          margin="normal"
          required
          disabled={loading}
          aria-label="Email"
          sx={{ mb: { xs: 1, sm: 2 } }}
        />
        <TextField
          label="Password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password && !!formik.errors.password}
          helperText={formik.touched.password && formik.errors.password}
          fullWidth
          margin="normal"
          required
          disabled={loading}
          aria-label="Password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: { xs: 1, sm: 2 } }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2, py: { xs: 1, sm: 1.5 } }}
          disabled={loading}
          aria-label="Login Button"
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </Box>
    </Card>
  );
};

export default LoginForm;