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
  useTheme,
  Button,
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
import HomeIcon from "@mui/icons-material/Home";
import ReviewsIcon from '@mui/icons-material/Reviews';
import PeopleIcon from "@mui/icons-material/People";
import GroupsIcon from '@mui/icons-material/Groups';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import BlockIcon from '@mui/icons-material/Block';
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from '@mui/icons-material/Menu';


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
  const [showLabel, setShowLabel] = useState(true);

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

  return (
    <Layout onProfileClick={setActiveTab}>
      {/* Loading backdrop */}
      <Backdrop open={loading} sx={{ zIndex: 1300 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box
        sx={{
          display: "flex",
          justifyContent: 'space-between',
          height: "90vh",
          bgcolor: "#f4f6f8",
          overflow: "hidden",
        }}
      >

        {/* LEFT SIDEBAR (CHAT STYLE NAV) */}
        <Box
          sx={{
            width: showLabel ? 200 : 100,
            transition: "width 0.25s",
            bgcolor: "white",
            borderRight: "1px solid #e2e2e2",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Toggle button */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <IconButton onClick={() => setShowLabel(x => !x)}>
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Tabs */}
          <Tabs
            orientation="vertical"
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              width: "100%",
              "& .MuiTab-root": {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: showLabel ? "flex-start" : "center",
                gap: showLabel ? 1.5 : 0,
                px: showLabel ? 2 : 1,
                py: 1.2,
                mb: 0.5,
                minHeight: 48,
                textTransform: "none",
                fontSize: "0.9rem",
                color: "#5f6368",
                opacity: showLabel ? 1 : 0.9,
                transition: "0.2s",

                "&:hover": {
                  bgcolor: "rgba(0,0,0,0.05)",
                },
              },

              "& .Mui-selected": {
                bgcolor: "primary.main",
                color: "white !important",
                fontWeight: "bold",
                "& .MuiSvgIcon-root": {
                  color: "white !important",
                },
              },

              "& .MuiTab-iconWrapper": {
                marginBottom: "0 !important",
              },
            }}
          >
            <Tab icon={<HomeIcon />} label={showLabel ? "Feed" : null} />
            <Tab icon={<ReviewsIcon />} label={showLabel ? "Messages" : null} />
            <Tab icon={<PeopleIcon />} label={showLabel ? "Friends" : null} />
            <Tab icon={<GroupsIcon />} label={showLabel ? "Groups" : null} />
            <Tab icon={<StickyNote2Icon />} label={showLabel ? "Notes" : null} />
            <Tab icon={<PersonSearchIcon />} label={showLabel ? "Search" : null} />
            <Tab icon={<BlockIcon />} label={showLabel ? "Blocked" : null} />
            <Tab icon={<PersonIcon />} label={showLabel ? "Profile" : null} />
          </Tabs>
        </Box>

        <Box sx={{
          width: '100%'
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

          {/* MESSAGES — chat style content fits perfectly */}
          <TabPanel value={activeTab} index={1}>
            <MessagesTab
              friends={friends}
              profile={profile}
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>

          {/* FRIENDS */}
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

          {/* GROUPS */}
          <TabPanel value={activeTab} index={3}>
            <GroupsTab
              groups={groups}
              onNewGroup={() => setGroupDialogOpen(true)}
              onViewGroup={handleViewGroup}
            />
          </TabPanel>

          {/* NOTES */}
          <TabPanel value={activeTab} index={4}>
            <NotesTab
              setError={setError}
              setSuccess={setSuccess}
            />
          </TabPanel>

          {/* SEARCH USERS */}
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

          {/* BLOCKED USERS */}
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