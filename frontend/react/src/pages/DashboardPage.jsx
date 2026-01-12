import {
  Alert,
  Backdrop,
  Box,
  CircularProgress,
  Collapse
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CreateGroupDialog from '../components/CreateGroupDialog';
import FeedTab from '../components/dashboard/FeedTab';
import FriendsTab from '../components/dashboard/FriendsTab';
import NotesTab from '../components/dashboard/NotesTab';
import ProfileSection from '../components/dashboard/ProfileSection';
import CreateDiaryDialog from '../components/dialogs/CreateDiaryDialog';
import ViewGroupDialog from '../components/dialogs/ViewGroupDialog';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getFeed, getFriends, getMe, getPendingRequests, getUserGroups, getSuggestFriends, getPendingFriends, getBlockedUsers, getAllSatusFriends } from '../services/api';
import ChatTab from '../components/dashboard/ChatTab';
import SettingTab from '../components/dashboard/SettingTab';

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
  const { isAuthenticated, auth } = useAuth();
  const user = auth.user;
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [friends, setFriends] = useState([]);
  const [pendingFriends, setPendingFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [groups, setGroups] = useState([]);

  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [suggestFriends, setSuggestFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [allSatusFriends, setAllSatusFriends] = useState([]);

  // Map URL paths to tab indices
  const pathToTabMap = {
    '/feed': 0,
    '/messages': 1,
    '/friends': 2,
    '/notes': 3,
    '/profile': 4,
    '/setting': 5,
  };

  // Map tab indices to URL paths
  const tabToPathMap = {
    0: '/feed',
    1: '/messages',
    2: '/friends',
    3: '/notes',
    4: '/profile',
    5: '/setting',
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

      const [friendsData, pendingData, feedData, groupsData, suggestFriendData, pendingFriendData, blockUserData, allSatusFriendData] = await Promise.all([
        getFriends().catch(() => []),
        getPendingRequests().catch(() => []),
        getFeed(25, 0).catch(() => []),
        getUserGroups().catch(() => []),
        getSuggestFriends().catch(() => []),
        getPendingFriends().catch(() => []),
        getBlockedUsers().catch(() => []),
        getAllSatusFriends().catch(() => []),

      ]);

      setFriends(friendsData);
      setPendingRequests(pendingData);
      setDiaries(feedData);
      setGroups(groupsData);
      setSuggestFriends(suggestFriendData);
      setPendingFriends(pendingFriendData);
      setBlockedUsers(blockUserData);
      setAllSatusFriends(allSatusFriendData);

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
    fetchDashboardData();
  }, [isAuthenticated, navigate, fetchDashboardData]);

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
      <Collapse in={!!error}>
        <Alert
          severity="error"
          sx={{
            position: "fixed",
            top: 20,
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
            top: 20,
            right: 20,
            zIndex: 2000,
            borderRadius: 2,
          }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      </Collapse>
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
              groups={groups}
              onNewDiary={() => setDiaryDialogOpen(true)}
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
              friends={allSatusFriends}
              pendingRequests={pendingRequests}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <ChatTab
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
              suggestFriends={suggestFriends}
              pendingFriends={pendingFriends}
              blockedUsers={blockedUsers}
              userId={user.id}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <NotesTab
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <ProfileSection
              profile={profile}
              setProfile={setProfile}
              error={error}
              success={success}
              setError={setError}
              setSuccess={setSuccess}
              onDataUpdate={fetchDashboardData}
              friends={allSatusFriends}
              onNewDiary={() => setDiaryDialogOpen(true)}
              groups={groups}
              onSetting={() => navigate('/setting')}
            />
          </TabPanel>
          <TabPanel value={activeTab} index={5}>
            <SettingTab />
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
          setTimeout(() => {
            setSuccess('');
          }, 2000);
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

    </Layout>
  );
};

export default DashboardPage;