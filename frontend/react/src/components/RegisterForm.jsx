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
import { register } from '../services/api';

const RegisterForm = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: { username: '', email: '', password: '' },
    validationSchema: Yup.object({
      username: Yup.string()
        .min(3, 'Username must be at least 3 characters')
        .required('Required'),
      email: Yup.string().email('Invalid email').required('Required'),
      password: Yup.string()
        .required('Required'),
    }),
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        await register(values);
        setSuccess('Verification code sent to your email');
        navigate('/verify-code', { state: { email: values.email } });
      } catch (err) {
        setError(err.msg || 'Registration failed');
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Card
      sx={{
        width: { xs: '100%', sm: '90%' },
        maxWidth: 500, // Moderate size, not too large
        mx: 'auto',
        p: { xs: 2, sm: 3 },
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
        Create Your Account
      </Typography>
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Collapse>
      <Collapse in={!!success}>
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      </Collapse>
      <Box component="form" onSubmit={formik.handleSubmit}>
        <TextField
          label="Username"
          name="username"
          value={formik.values.username}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.username && !!formik.errors.username}
          helperText={formik.touched.username && formik.errors.username}
          fullWidth
          margin="normal"
          required
          disabled={loading}
          aria-label="Username"
          sx={{ mb: { xs: 1, sm: 2 } }}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email && !!formik.errors.email}
          helperText={formik.touched.email && formik.errors.email}
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
          aria-label="Register Button"
        >
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </Box>
    </Card>
  );
};

export default RegisterForm;