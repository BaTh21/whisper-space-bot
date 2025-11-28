//DashboardPage.jsx
import {
  Alert,
  Backdrop,
  Box,
  CircularProgress,
  Collapse,
  Tab,
  Tabs,
  IconButton
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`main-tabpanel-${index}`}
      aria-labelledby={`main-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

const DashboardPage = ({ defaultTab = 0 }) => {
  const { isAuthenticated, auth, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [groups, setGroups] = useState([]);

  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Map URL paths to tab indices
  const pathToTabMap = {
    '/feed': 0,
    '/messages': 1,
    '/friends': 2,
    '/groups': 3,
    '/notes': 4,
    '/search': 5,
    '/blocked': 6,
    '/profile': 7,
  };

  // Map tab indices to URL paths
  const tabToPathMap = {
    0: '/feed',
    1: '/messages',
    2: '/friends',
    3: '/groups',
    4: '/notes',
    5: '/search',
    6: '/blocked',
    7: '/profile',
  };

  // Handle URL-based tab navigation
  useEffect(() => {
    const currentTab = pathToTabMap[location.pathname] || 0;
    setActiveTab(currentTab);
  }, [location.pathname]);

  // Update URL when tab changes
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const newPath = tabToPathMap[newTab] || '/feed';
    navigate(newPath);
  };

  // Initial data fetch - ONLY on component mount
  const fetchDashboardData = useCallback(async () => {
    try {
      let profileData = auth?.user;
      if (!profileData) {
        profileData = await getMe();
        setProfile(profileData);
      } else {
        setProfile(profileData);
      }

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
      setError(err.message || 'Failed to fetch data');
    } finally {
      setInitialLoading(false);
    }
  }, [auth?.user]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // Only fetch data on initial load, not on tab changes
    fetchDashboardData();
  }, [isAuthenticated, navigate, fetchDashboardData]);

  const handleViewGroup = (group) => {
    setSelectedGroup(group);
    setViewGroupDialogOpen(true);
  };

  // Show loading only during initial page load
  if (initialLoading) {
    return (
      <Layout>
        <Backdrop open={true} sx={{ zIndex: 1300, color: '#40C4FF' }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Layout>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <Layout>
        <Backdrop open={true} sx={{ zIndex: 1300, color: '#40C4FF' }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Layout>
    );
  }

  return (
    <Layout onProfileClick={handleTabChange} setNewActiveTab={handleTabChange}>
      <Box
        sx={{
          display: "flex",
          justifyContent: 'space-between',
          height: "100vh",
          bgcolor: "#f4f6f8",
          overflow: "hidden",
        }}
      >

        <Box sx={{
          width: '100%',
          mt: 6
        }}>
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

          <TabPanel value={activeTab} index={1}>
            <MessagesTab
              friends={friends}
              profile={profile}
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <FriendsTab
              friends={friends}
              pendingRequests={pendingRequests}
              profile={profile}
              setActiveTab={handleTabChange}
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <GroupsTab
              groups={groups}
              onNewGroup={() => setGroupDialogOpen(true)}
              onViewGroup={handleViewGroup}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            <NotesTab
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>

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

          <TabPanel value={activeTab} index={6}>
            <BlockedUsersTab
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={7}>
            <ProfileSection
              profile={profile}
              setProfile={setProfile}
              error={error}
              success={success}
              setError={setError}
              setSuccess={setSuccess}
              onProfileUpdate={fetchDashboardData}
            />
          </TabPanel>
        </Box>
      </Box>

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

      <CreateGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onSuccess={(newGroup) => {
          setGroups(prev => [...prev, newGroup]);
          setGroupDialogOpen(false);
          setSuccess('Group created successfully!');
          fetchDashboardData(); 
        }}
        friends={friends}
      />

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

      <Collapse in={!!error}>
        <Alert
          severity="error"
          sx={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 2000,
            borderRadius: 2,
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
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 2000,
            borderRadius: 2,
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