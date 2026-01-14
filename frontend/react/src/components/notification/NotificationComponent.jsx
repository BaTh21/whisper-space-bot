
import { Box, Button, Typography, Stack } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function NotificationComponent({ onBack }) {
    return (
        <Box>
            <Stack spacing={1} mb={3}>
                <Button
                    sx={{
                        mb: 2,
                        fontSize: 16,
                        width: '100%',
                        display: { xs: 'flex', sm: 'none' },
                        justifyContent: 'start',
                        color: 'primary.contrastText',
                        backgroundImage: 'linear-gradient(90deg, #254D70, #1e78c7ff, #198d17e7)',
                        backgroundSize: '200% 100%',
                        backgroundPosition: '0% 50%',

                        transition: 'background-position 0.4s ease, box-shadow 0.3s ease',

                        '&:hover': {
                            backgroundPosition: '100% 50%',
                            boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                            transform: 'scale(1)'
                        },
                    }}
                    onClick={onBack}
                >
                    <ArrowBackIcon sx={{ mr: 1 }} />
                    BACK TO SETTING PAGE
                </Button>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >

                    <Typography variant="h5" fontWeight={600}>
                        Notifications
                    </Typography>
                </Box>
                <Typography color="text.secondary">
                    Manage your account notifications
                </Typography>
            </Stack>
        </Box>
    )
}

export default NotificationComponent
