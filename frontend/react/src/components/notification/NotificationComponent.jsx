import { useState, useEffect } from "react";
import { Box, Typography, Stack, Paper, Switch, FormControlLabel, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { storePlayerId, removePlayerId } from "../../services/api";

function NotificationComponent({ onBack }) {

    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const checkSubscription = async () => {
            if (!window.OneSignal) return;

            try {
                const playerId = await OneSignal.User.PushSubscription.id;
                setIsEnabled(!!playerId);
            } catch (err) {
                console.error("Error checking subscription", err);
            }
        };

        checkSubscription();
    }, []);

    const handleToggle = async (e) => {
        const enable = e.target.checked;
        setLoading(true);

        try {
            if (!window.OneSignal) {
                setError("Some browser is blocked notifications!!!, Please unblock to use.");
                throw new Error("OneSignal not ready");
            }

            if (enable) {
                await OneSignal.Notifications.requestPermission();

                const playerId = await OneSignal.User.PushSubscription.id;
                if (playerId) {
                    await storePlayerId(playerId);
                    setIsEnabled(true);
                } else {
                    setError("Unable to enable notifications. Please allow notifications in your browser settings.");
                    setIsEnabled(false);
                }
            } else {
                const sub = OneSignal.User.PushSubscription;

                if (sub?.optedIn) {
                    await sub.optOut();
                }

                await removePlayerId();
                setError("Something went wrong while toggling notifications.");
                setIsEnabled(false);
            }
        } catch (err) {
            console.error("Failed to toggle notifications", err);
            setIsEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Stack spacing={1} mb={3}>
                <Button
                    sx={{
                        mb: 2,
                        fontSize: 16,
                        width: '100%',
                        display: {xs: 'flex', sm: 'none'},
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
                    BACK TO MENU PAGE
                </Button>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h5" fontWeight={600}>
                        Notifications
                    </Typography>
                </Box>

                <Typography color="text.secondary">
                    Manage your account notifications
                </Typography>
                <br />
                {error && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}
                <Typography fontWeight={600} sx={{ mt: 2 }}>
                    Notification Details
                </Typography>
                <Paper
                    elevation={0}
                    sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: "divider" }}
                >
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems={{ sm: "center" }}
                        justifyContent="space-between"
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <NotificationsRoundedIcon sx={{ color: "primary.main" }} />
                            <Box>
                                <Typography fontWeight={600}>Enable Notification</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Enable notification for faster updates
                                </Typography>
                            </Box>
                        </Stack>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isEnabled}
                                    onChange={handleToggle}
                                    disabled={loading}
                                />
                            }
                            label={isEnabled ? "Enabled" : "Disabled"}
                        />
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
}

export default NotificationComponent;
