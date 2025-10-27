import {
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  Link as MuiLink,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { verifyCode } from '../services/api';

const VerifyCodeForm = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const formik = useFormik({
    initialValues: { email: location.state?.email || '', code: '' },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Required'),
      code: Yup.string()
        .matches(/^\d{6}$/, 'Code must be 6 digits')
        .required('Required'),
    }),
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        await verifyCode(values);
        setSuccess('Email verified successfully');
        setTimeout(() => navigate('/login'), 2000);
      } catch (err) {
        setError(err.msg || 'Verification failed');
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    const emailFromLocation = location.state?.email;
    if (emailFromLocation && formik.values.email !== emailFromLocation) {
      formik.setFieldValue('email', emailFromLocation);
    }
  }, [location.state?.email]); // Only depend on email string

  return (
    <Card
      sx={{
        width: { xs: '100%', sm: '90%' },
        maxWidth: 500,
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
        Verify Your Email
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
          label="Verification Code"
          name="code"
          value={formik.values.code}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.code && !!formik.errors.code}
          helperText={formik.touched.code && formik.errors.code}
          fullWidth
          margin="normal"
          required
          disabled={loading}
          aria-label="Verification Code"
          sx={{ mb: { xs: 1, sm: 2 } }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2, py: { xs: 1, sm: 1.5 } }}
          disabled={loading}
          aria-label="Verify Button"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
        <MuiLink
          component={RouterLink}
          to="/register"
          sx={{
            mt: 2,
            display: 'block',
            textAlign: 'center',
            color: 'secondary.main',
            fontSize: { xs: '0.8rem', sm: '0.9rem' },
          }}
          aria-label="Resend verification code"
        >
          Resend Verification Code
        </MuiLink>
      </Box>
    </Card>
  );
};

export default VerifyCodeForm;