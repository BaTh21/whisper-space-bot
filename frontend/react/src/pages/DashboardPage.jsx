import {
  Alert,
  Backdrop,
  Box,
  Card,
  CircularProgress,
  Collapse,
  Tab,
  Tabs,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockedUsersTab from '../components/BlockedUsersTab';
import FeedTab from '../components/dashboard/FeedTab';
import FriendsTab from '../components/dashboard/FriendsTab';
import GroupsTab from '../components/dashboard/GroupsTab';
import MessagesTab from '../components/dashboard/MessagesTab';
import NotesTab from '../components/dashboard/NotesTab';
import ProfileSection from '../components/dashboard/ProfileSection';
import SearchUsersTab from '../components/dashboard/SearchUsersTab';
import CreateDiaryDialog from '../components/dialogs/CreateDiaryDialog';
import CreateGroupDialog from '../components/dialogs/CreateGroupDialog';
import ViewGroupDialog from '../components/dialogs/ViewGroupDialog';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getFeed, getFriends, getMe, getPendingRequests, getUserGroups } from '../services/api';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

const DashboardPage = () => {
  const { isAuthenticated, auth, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Data states
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [groups, setGroups] = useState([]);

  // Dialog states
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Memoized data fetching function
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Use profile from auth context if available, otherwise fetch it
      let profileData = auth?.user;
      if (!profileData) {
        profileData = await getMe();
        setProfile(profileData);
      } else {
        setProfile(profileData);
      }

      // Fetch other data in parallel
      const [friendsData, pendingData, feedData, groupsData] = await Promise.all([
        getFriends().catch(() => []),
        getPendingRequests().catch(() => []),
        getFeed().catch(() => []),
        getUserGroups().catch(() => []),
      ]);

      setFriends(friendsData);
      setPendingRequests(pendingData);
      setDiaries(feedData);
      setGroups(groupsData);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [auth?.user]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // Only fetch data once when component mounts
    fetchDashboardData();
  }, [isAuthenticated, navigate, fetchDashboardData]);

  const handleTabChange = (e, newValue) => {
    setActiveTab(newValue);
  };

  const handleViewGroup = (group) => {
    setSelectedGroup(group);
    setViewGroupDialogOpen(true);
  };

  // FIXED: Added proper loading state and null checks
  if (loading && !profile) {
    return (
      <Layout>
        <Backdrop open={true} sx={{ zIndex: 1300, color: '#40C4FF' }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Layout>
    );
  }

  // FIXED: Added check for authentication and profile
  if (!isAuthenticated || !profile) {
    return (
      <Layout>
        <Backdrop open={true} sx={{ zIndex: 1300, color: '#40C4FF' }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Layout>
    );
  }

  // Tab labels for mobile (shorter versions)
  const getTabLabel = (label) => {
    if (!isMobile) return label;
    
    const mobileLabels = {
      'Feed': 'Feed',
      'Messages': 'Chat',
      'Friends': 'Friends',
      'Groups': 'Groups',
      'Notes': 'Notes',
      'Search Users': 'Search',
      'Blocked Users': 'Blocked'
    };
    
    return mobileLabels[label] || label;
  };

  return (
    <Layout>
      <Backdrop open={loading} sx={{ zIndex: 1300, color: '#40C4FF' }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ 
        width: '100%', 
        maxWidth: 1200, 
        mx: 'auto', 
        p: { xs: 1, sm: 2 },
        minHeight: '100vh'
      }}>

        {/* Header */}
        <ProfileSection 
          profile={profile}
          setProfile={setProfile}
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onProfileUpdate={fetchDashboardData}
        />

        {/* Main Content with Tabs */}
        <Card sx={{ 
          borderRadius: '16px', 
          overflow: 'hidden',
          mb: { xs: 2, sm: 3 }
        }}>
          {/* Responsive Tabs */}
          <Box sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            overflow: 'hidden'
          }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant={isMobile ? "scrollable" : "standard"}
              scrollButtons={isMobile ? "auto" : false}
              allowScrollButtonsMobile
              sx={{
                minHeight: { xs: 48, sm: 60 },
                '& .MuiTab-root': {
                  borderRadius: '8px 8px 0 0',
                  minHeight: { xs: 48, sm: 60 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  px: { xs: 1, sm: 2 },
                  minWidth: 'auto',
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                  }
                },
                '& .MuiTabs-scrollButtons': {
                  width: { xs: 32, sm: 40 },
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  }
                }
              }}
            >
              <Tab label={getTabLabel("Feed")} />
              <Tab label={getTabLabel("Messages")} />
              <Tab label={getTabLabel("Friends")} />
              <Tab label={getTabLabel("Groups")} />
              <Tab label={getTabLabel("Notes")} />
              <Tab label={getTabLabel("Search Users")} />
              <Tab label={getTabLabel("Blocked Users")} />
            </Tabs>
          </Box>

          {/* Feed Tab */}
          <TabPanel value={activeTab} index={0}>
            <FeedTab
              diaries={diaries}
              profile={profile}
              onNewDiary={() => setDiaryDialogOpen(true)}
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
            />
          </TabPanel>

          {/* Messages Tab - Only load when active */}
          <TabPanel value={activeTab} index={1}>
            {activeTab === 1 && (
              <MessagesTab
                friends={friends}
                profile={profile}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
          </TabPanel>

          {/* Friends Tab */}
          <TabPanel value={activeTab} index={2}>
            <FriendsTab
              friends={friends}
              pendingRequests={pendingRequests}
              profile={profile}
              setActiveTab={setActiveTab}
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
            />
          </TabPanel>

          {/* Groups Tab */}
          <TabPanel value={activeTab} index={3}>
            <GroupsTab
              groups={groups}
              onNewGroup={() => setGroupDialogOpen(true)}
              onViewGroup={handleViewGroup}
            />
          </TabPanel>

          {/* Notes Tab */}
          <TabPanel value={activeTab} index={4}>
            <NotesTab
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>

          {/* Search Users Tab */}
          <TabPanel value={activeTab} index={5}>
            <SearchUsersTab
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
              friends={friends}
              pendingRequests={pendingRequests}
              currentUser={currentUser || profile}
            />
          </TabPanel>

          {/* Blocked Users Tab */}
          <TabPanel value={activeTab} index={6}>
            <BlockedUsersTab
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
            />
          </TabPanel>
        </Card>
      </Box>

      {/* Create Diary Dialog */}
      <CreateDiaryDialog
        open={diaryDialogOpen}
        onClose={() => setDiaryDialogOpen(false)}
        groups={groups}
        onSuccess={() => {
          setDiaryDialogOpen(false);
          fetchDashboardData();
          setSuccess('Diary created successfully');
        }}
        setError={setError}
      />

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSuccess={(newGroup) => {
          setGroups(prev => [...prev, newGroup]);
          setGroupDialogOpen(false);
          setSuccess('Group created successfully!');
          fetchDashboardData(); // Refresh data to show new group
        }}
        friends={friends}
      />

      {/* View Group Dialog */}
      <ViewGroupDialog
        open={viewGroupDialogOpen}
        onClose={() => setViewGroupDialogOpen(false)}
        group={selectedGroup}
        profile={profile}
        onJoinSuccess={() => {
          setViewGroupDialogOpen(false);
          fetchDashboardData();
          setSuccess('Successfully joined the group!');
        }}
        setError={setError}
        setSuccess={setSuccess}
      />

      {/* Global Error/Success Alerts */}
      <Collapse in={!!error}>
        <Alert 
          severity="error" 
          sx={{ 
            position: 'fixed', 
            top: { xs: 70, sm: 80 }, 
            right: { xs: 10, sm: 20 }, 
            left: { xs: 10, sm: 'auto' },
            zIndex: 9999,
            width: { xs: 'calc(100% - 20px)', sm: 'auto' },
            minWidth: { xs: 'auto', sm: 300 }
          }} 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      </Collapse>

      <Collapse in={!!success}>
        <Alert 
          severity="success" 
          sx={{ 
            position: 'fixed', 
            top: { xs: 70, sm: 80 }, 
            right: { xs: 10, sm: 20 }, 
            left: { xs: 10, sm: 'auto' },
            zIndex: 9999,
            width: { xs: 'calc(100% - 20px)', sm: 'auto' },
            minWidth: { xs: 'auto', sm: 300 }
          }} 
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      </Collapse>
    </Layout>
  );
};

export default DashboardPage;