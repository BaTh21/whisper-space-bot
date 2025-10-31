// components/dashboard/GroupsTab.jsx
import { Chat as ChatIcon, Group as GroupIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    IconButton,
    Tooltip,
    Typography
} from '@mui/material';
import { Link } from 'react-router-dom';
import { formatCambodiaDate } from '../../utils/dateUtils';

const GroupsTab = ({ groups, onNewGroup, onViewGroup }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="600">Groups</Typography>
        <Button 
          variant="contained" 
          onClick={onNewGroup} 
          startIcon={<GroupIcon />}
          sx={{ borderRadius: '8px' }}
        >
          Create Group
        </Button>
      </Box>

      {groups.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No groups yet. Create one to get started!
        </Typography>
      ) : (
        groups.map((group) => (
          <Card 
            key={group.id} 
            sx={{ 
              p: 3, 
              mb: 2, 
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight="600">{group.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Created {formatCambodiaDate(group.created_at)}
                </Typography>
                {group.description && (
                  <Typography sx={{ mt: 1, fontStyle: 'italic', lineHeight: 1.6 }}>
                    {group.description}
                  </Typography>
                )}
                {group.member_count && (
                  <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                    {group.member_count} members
                  </Typography>
                )}
              </Box>
              <Box>
                <Tooltip title="View Group">
                  <IconButton 
                    onClick={() => onViewGroup(group)}
                    sx={{ 
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.main' },
                      borderRadius: '8px',
                      mr: 1
                    }}
                  >
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open Chat">
                  <IconButton 
                    component={Link} 
                    to={`/group/${group.id}`}
                    sx={{ 
                      bgcolor: 'secondary.light',
                      color: 'secondary.contrastText',
                      '&:hover': { bgcolor: 'secondary.main' },
                      borderRadius: '8px'
                    }}
                  >
                    <ChatIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Card>
        ))
      )}
    </Box>
  );
};

export default GroupsTab;