//dashboard/GroupsTab.jsx
import { Chat as ChatIcon, Group as GroupIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import { formatCambodiaDate } from '../../utils/dateUtils';

const GroupsTab = ({ groups, onNewGroup, onViewGroup }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 3 
      }}>
        <Typography variant="h5" fontWeight="600" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
          Groups
        </Typography>
        <Button 
          variant="contained" 
          onClick={onNewGroup} 
          startIcon={<GroupIcon />}
          sx={{ 
            borderRadius: '8px',
            minWidth: { xs: '100%', sm: 'auto' }
          }}
          size={isMobile ? 'small' : 'medium'}
        >
          {isMobile ? 'Create' : 'Create Group'}
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
              p: { xs: 2, sm: 3 }, 
              mb: 2, 
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: { xs: 'none', sm: 'translateY(-2px)' },
                boxShadow: { xs: 'none', sm: '0 4px 12px rgba(0,0,0,0.1)' },
              }
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', sm: 'flex-start' },
              gap: { xs: 2, sm: 0 }
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                  {group.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  Created {formatCambodiaDate(group.created_at)}
                </Typography>
                {group.description && (
                  <Typography sx={{ 
                    mt: 1, 
                    fontStyle: 'italic', 
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    {group.description}
                  </Typography>
                )}
                {group.member_count && (
                  <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                    {group.member_count} members
                  </Typography>
                )}
              </Box>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                alignSelf: { xs: 'stretch', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-end' }
              }}>
                <Tooltip title="View Group">
                  <IconButton 
                    onClick={() => onViewGroup(group)}
                    sx={{ 
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.main' },
                      borderRadius: '8px',
                      flex: { xs: 1, sm: 'none' },
                      mx: { xs: 0.5, sm: 0 }
                    }}
                    size={isMobile ? 'small' : 'medium'}
                  >
                    <VisibilityIcon fontSize={isMobile ? 'small' : 'medium'} />
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
                      borderRadius: '8px',
                      flex: { xs: 1, sm: 'none' },
                      mx: { xs: 0.5, sm: 0 }
                    }}
                    size={isMobile ? 'small' : 'medium'}
                  >
                    <ChatIcon fontSize={isMobile ? 'small' : 'medium'} />
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