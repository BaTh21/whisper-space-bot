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

const DashboardPage = ({ defaultTab = 0 }) => {
  const { isAuthenticated, auth, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
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
    fetchDashboardData();
  }, [isAuthenticated, navigate, fetchDashboardData]);

  const handleViewGroup = (group) => {
    setSelectedGroup(group);
    setViewGroupDialogOpen(true);
  };

  if (loading && !profile) {
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
    <Layout onProfileClick={setActiveTab} setNewActiveTab={setActiveTab}>
      <Backdrop open={loading} sx={{ zIndex: 1300 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

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
              setActiveTab={setActiveTab}
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