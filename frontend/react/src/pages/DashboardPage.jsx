import {
  Alert,
  Avatar,
  Backdrop,
  Box,
  Button,
  Card,
  CircularProgress,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getMe, searchUsers, updateMe } from '../services/api';

const DashboardPage = () => {
  const { isAuthenticated, user: authUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(authUser);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [isAuthenticated, navigate]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await getMe();
      setProfile(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || '',
    },
    validationSchema: Yup.object({
      username: Yup.string().min(3, 'Username must be at least 3 characters').required('Required'),
      bio: Yup.string().max(500, 'Bio must be less than 500 characters'),
      avatar_url: Yup.string().url('Must be a valid URL'),
    }),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError(null);
      setSuccess(null);
      setLoading(true);
      try {
        const response = await updateMe(values);
        setProfile(response);
        setEditing(false);
        setSuccess('Profile updated successfully');
        setTimeout(() => setSuccess(null), 3000); // Auto-clear success after 3s
      } catch (err) {
        setError(err.message || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    },
  });

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Backdrop open={loading} sx={{ zIndex: 1300, color: '#40C4FF' }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Card
        sx={{
          width: { xs: '100%', sm: '90%' },
          maxWidth: 500,
          mx: 'auto',
          p: { xs: 2, sm: 3 },
          bgcolor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          mt: { xs: 8, sm: 10 }, // Offset for Navbar
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)', transform: 'translateY(-2px)' },
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
          align="center"
          sx={{
            fontWeight: 500,
            color: '#0288D1',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Dashboard
        </Typography>
        <Collapse in={!!error} timeout={300}>
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: 12,
              bgcolor: '#FFEBEE',
              color: '#D32F2F',
              '& .MuiAlert-icon': { color: '#D32F2F' },
            }}
          >
            {error}
          </Alert>
        </Collapse>
        <Collapse in={!!success} timeout={300}>
          <Alert
            severity="success"
            sx={{
              mb: 2,
              borderRadius: 12,
              bgcolor: '#E8F5E9',
              color: '#2E7D32',
              '& .MuiAlert-icon': { color: '#2E7D32' },
            }}
          >
            {success}
          </Alert>
        </Collapse>
        {editing ? (
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
              sx={{
                mb: { xs: 1, sm: 2 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 12,
                  '& fieldset': { borderColor: '#B0BEC5' },
                  '&:hover fieldset': { borderColor: '#40C4FF' },
                  '&.Mui-focused fieldset': { borderColor: '#0288D1' },
                },
              }}
              InputLabelProps={{ sx: { color: '#757575' } }}
              aria-label="Username"
            />
            <TextField
              label="Bio"
              name="bio"
              value={formik.values.bio}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.bio && !!formik.errors.bio}
              helperText={formik.touched.bio && formik.errors.bio}
              fullWidth
              margin="normal"
              multiline
              rows={3}
              sx={{
                mb: { xs: 1, sm: 2 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 12,
                  '& fieldset': { borderColor: '#B0BEC5' },
                  '&:hover fieldset': { borderColor: '#40C4FF' },
                  '&.Mui-focused fieldset': { borderColor: '#0288D1' },
                },
              }}
              InputLabelProps={{ sx: { color: '#757575' } }}
              aria-label="Bio"
            />
            <TextField
              label="Avatar URL"
              name="avatar_url"
              value={formik.values.avatar_url}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.avatar_url && !!formik.errors.avatar_url}
              helperText={formik.touched.avatar_url && formik.errors.avatar_url}
              fullWidth
              margin="normal"
              sx={{
                mb: { xs: 1, sm: 2 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 12,
                  '& fieldset': { borderColor: '#B0BEC5' },
                  '&:hover fieldset': { borderColor: '#40C4FF' },
                  '&.Mui-focused fieldset': { borderColor: '#0288D1' },
                },
              }}
              InputLabelProps={{ sx: { color: '#757575' } }}
              aria-label="Avatar URL"
            />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                type="submit"
                variant="contained"
                sx={{
                  flex: 1,
                  py: 1.5,
                  borderRadius: 12,
                  bgcolor: '#40C4FF',
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: '#0288D1',
                    transform: 'scale(1.02)',
                    transition: 'all 0.2s ease',
                  },
                }}
                aria-label="Save Profile"
              >
                Save
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditing(false)}
                sx={{
                  flex: 1,
                  py: 1.5,
                  borderRadius: 12,
                  borderColor: '#B0BEC5',
                  color: '#424242',
                  '&:hover': {
                    borderColor: '#40C4FF',
                    color: '#0288D1',
                    transform: 'scale(1.02)',
                    transition: 'all 0.2s ease',
                  },
                }}
                aria-label="Cancel Edit"
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                src={profile?.avatar_url}
                alt={profile?.username || 'User'}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  border: '2px solid #40C4FF',
                  mr: 2,
                }}
              />
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 500,
                    color: '#212121',
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                  }}
                >
                  {profile?.username || 'User'}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: '#757575', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  {profile?.email || 'No email'}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: profile?.is_verified ? '#2E7D32' : '#D32F2F',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  }}
                >
                  Verified: {profile?.is_verified ? 'Yes' : 'No'}
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="body1"
              sx={{
                mb: 3,
                whiteSpace: 'pre-line',
                color: '#424242',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                lineHeight: 1.5,
              }}
            >
              {profile?.bio || 'No bio yet.'}
            </Typography>
            <Button
              variant="contained"
              sx={{
                mb: 3,
                py: 1.5,
                borderRadius: 12,
                bgcolor: '#40C4FF',
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: '#0288D1',
                  transform: 'scale(1.02)',
                  transition: 'all 0.2s ease',
                },
              }}
              fullWidth
              onClick={() => setEditing(true)}
              aria-label="Edit Profile"
            >
              Edit Profile
            </Button>
            <Divider sx={{ my: 2, bgcolor: '#E0E0E0', borderWidth: 0.5 }} />
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontWeight: 500,
                color: '#0288D1',
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              Search Users
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField
                label="Search users"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                sx={{
                  mb: { xs: 1, sm: 0 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 12,
                    '& fieldset': { borderColor: '#B0BEC5' },
                    '&:hover fieldset': { borderColor: '#40C4FF' },
                    '&.Mui-focused fieldset': { borderColor: '#0288D1' },
                  },
                }}
                InputLabelProps={{ sx: { color: '#757575' } }}
                aria-label="Search users"
              />
              <Button
                variant="contained"
                sx={{
                  py: 1.5,
                  borderRadius: 12,
                  bgcolor: '#40C4FF',
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: '#0288D1',
                    transform: 'scale(1.02)',
                    transition: 'all 0.2s ease',
                  },
                }}
                onClick={handleSearch}
                aria-label="Search"
              >
                Search
              </Button>
            </Box>
            {searchResults.length > 0 && (
              <List
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  borderRadius: 12,
                  bgcolor: '#F5F5F5',
                  p: 1,
                }}
              >
                {searchResults.map((user) => (
                  <ListItem
                    key={user.id}
                    sx={{
                      borderRadius: 8,
                      '&:hover': { bgcolor: '#E0F7FA', transition: 'all 0.2s ease' },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={user.avatar_url}
                        alt={user.username}
                        sx={{ width: 40, height: 40, borderRadius: '50%' }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.username}
                      secondary={user.email}
                      primaryTypographyProps={{
                        color: '#212121',
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                      }}
                      secondaryTypographyProps={{
                        color: '#757575',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </Card>
    </Layout>
  );
};

export default DashboardPage;