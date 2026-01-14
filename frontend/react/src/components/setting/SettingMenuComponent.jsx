import {
    Box,
    Typography,
    Paper,
    Stack,
    Button,
    Divider,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert
} from "@mui/material";
import { useState } from "react"
import SecurityIcon from "@mui/icons-material/Security";
import LockIcon from "@mui/icons-material/Lock";
import EmailIcon from "@mui/icons-material/Email";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import BlockIcon from "@mui/icons-material/Block";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { deactivateAccount } from "../../services/api";
import { useAuth } from '../../context/AuthContext';

function SettingMenuComponent({ onNavigate, onBack, profile }) {
    const [openDeactivate, setOpenDeactivate] = useState(false);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { logout } = useAuth();

    const handleDeactivate = async () => {
        setLoading(true);
        setError(null);

        try {
            await deactivateAccount({ password });

            logout();

            window.location.href = "/login";
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const Section = ({ icon, title, description, actionText, color = "primary", onClick }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.5,
                borderRadius: 2,
                border: 1,
                borderColor: "divider"
            }}
        >
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    {icon}
                    <Box>
                        <Typography fontWeight={600}>
                            {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {description}
                        </Typography>
                    </Box>
                </Stack>

                <Button
                    variant="outlined"
                    color={color}
                    sx={{ minWidth: 150, borderRadius: 1 }}
                    onClick={onClick}
                >
                    {actionText}
                </Button>
            </Stack>
        </Paper>
    );

    return (
        <Box
            sx={{
                height: '80vh',
                overflowY: 'auto',
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
            }}
        >
            <Stack spacing={1} mb={3}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >
                    <IconButton
                        onClick={onBack}
                        sx={{
                            display: { xs: 'block', md: 'none' }
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h5" fontWeight={600}>
                        Security and Privacy
                    </Typography>
                </Box>
                <Typography color="text.secondary">
                    Manage your account security and recovery options
                </Typography>
            </Stack>

            <Stack spacing={2}>
                <Typography fontWeight={600}>Account Details</Typography>

                <Section
                    icon={<SecurityIcon color="primary" />}
                    title="Login Information"
                    description="View recent login activity and devices"
                    actionText="View Details"
                    onClick={() => onNavigate("login_details")}
                />

                <Section
                    icon={<LockIcon color="primary" />}
                    title="Update Password"
                    description="Change your account password"
                    actionText="Change Password"
                    onClick={() => onNavigate("change_password")}
                />

                <Divider />

                <Typography fontWeight={600}>Recovery Settings</Typography>

                <Section
                    icon={<EmailIcon color="primary" />}
                    title="Recovery Email"
                    description="Update recovery email for account recovery"
                    actionText="Change"
                    onClick={() => onNavigate("recovery_email")}
                />

                {/* <Section
                    icon={<PhoneIcon color="primary" />}
                    title="Recovery Phone Number"
                    description="Add a phone number for account recovery"
                    actionText="Setup"
                    color="success"
                /> */}

                <Divider />

                <Typography fontWeight={600}>Two-Factor Authentication</Typography>

                <Section
                    icon={<VerifiedUserIcon color="primary" />}
                    title="Two-Factor Authentication"
                    description="Add an extra layer of security to your account"
                    actionText={profile.is_2fa_enabled ? 'Disable' : 'Enable'}
                    onClick={() => onNavigate("two_fa")}
                    color={profile.is_2fa_enabled ? 'error' : 'success'}
                />

                <Divider />

                <Typography fontWeight={600} color="error">
                    Danger Zone
                </Typography>

                <Section
                    icon={<BlockIcon color="error" />}
                    title="Deactivate Account"
                    description="Temporarily disable your account. You can reactivate by signing in."
                    actionText="Deactivate"
                    color="error"
                    onClick={() => setOpenDeactivate(true)}
                />
            </Stack>

            <Dialog
                open={openDeactivate}
                onClose={() => setOpenDeactivate(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle color="error">
                    Deactivate Account
                </DialogTitle>

                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This will immediately deactivate your account and log you out.
                    </Alert>

                    <TextField
                        label="Confirm Password"
                        type="password"
                        fullWidth
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />

                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setOpenDeactivate(false)}
                        disabled={loading}
                        sx={{
                            borderRadius: 1
                        }}
                        variant="outlined"
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDeactivate}
                        disabled={!password || loading}
                        sx={{
                            borderRadius: 1
                        }}
                    >
                        Deactivate
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}

export default SettingMenuComponent;
