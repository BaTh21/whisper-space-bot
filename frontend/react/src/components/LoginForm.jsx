import LogoImg from '@/assets/Login1.gif';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';

const LoginForm = () => {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validationSchema: Yup.object({
      username: Yup.string().email(t('invalid_email')).required(t('required')),
      password: Yup.string().required(t('required')),
    }),
    onSubmit: async (values) => {
      setError(null);
      setLoading(true);
      try {
        const response = await loginApi({
          email: values.username,
          password: values.password,
        });

        await login(response);
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || t('login_failed'));
        toast.error(`${t('failed')}: ${err.message}`);
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
            {t('sign_in')}
          </Typography>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Collapse>

          <Box component="form" onSubmit={formik.handleSubmit}>
            {/* Email */}
            <TextField
              label={t('email')}
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

            {/* Password */}
            <TextField
              label={t('password')}
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

            {/* Create Account Link */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: 'center',
                mt: 1,
              }}
            >
              <Typography variant="body2">{t('dont_have_account')}</Typography>

              <Button sx={{ color: "red" }} onClick={() => navigate("/register")}>
                {t('create_new')}
              </Button>
            </Box>

            {/* Login Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3, py: 1.5 }}
              disabled={loading}
            >
              {loading ? t('logging_in') : t('login')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginForm;
