import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Paper
} from "@mui/material";
import { requestChangeEmail, changeEmailVerify } from "../../../services/api";

function RecoveryEmailView({profile, onDataUpdate}) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [codeTimestamp, setCodeTimestamp] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const inputsRef = useRef([]);

  const handleRequestCode = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await requestChangeEmail({ new_email: email });
      setSuccess(res?.msg || "Verification code sent to your new email.");
      setStep(2);

      const now = Date.now();
      setCodeTimestamp(now);
      setTimeLeft(10 * 60);
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const fullCode = code.join("");
      const res = await changeEmailVerify({
        new_email: email,
        code: fullCode
      });

      setSuccess(res?.msg || "Email changed successfully.");
      setCode(["", "", "", "", "", ""]);
      setCodeTimestamp(null);
      setTimeLeft(0);
      setStep(1);
      onDataUpdate();
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value, index) => {
    if (!/^\d*$/.test(value)) return; // only digits

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputsRef.current[index + 1].focus();
    }
    if (!value && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  useEffect(() => {
    if (!codeTimestamp) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - codeTimestamp) / 1000);
      const remaining = 10 * 60 - elapsed;
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setStep(1);
        setCode(["", "", "", "", "", ""]);
        setCodeTimestamp(null);
        setTimeLeft(0);
        setError("Verification code expired. Please request a new one.");
        setSuccess("");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [codeTimestamp]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
    >
      <Paper elevation={3}
        sx={{
          width: '100%',
          boxShadow: 0
        }}>
        <Stack spacing={3}>
          <Typography variant="h6" fontWeight={600}>
            Change Email
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          {step === 1 && (
            <>
              <TextField
                label="New Email Address"
                type="email"
                value={email || profile.email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                disabled={loading}
              />
              <Button
                variant="contained"
                onClick={handleRequestCode}
                disabled={loading || !email || email === profile.email}
                fullWidth
                sx={{
                  width: 200,
                  borderRadius: 1
                }}
              >
                {loading ? <CircularProgress size={24} /> : "Send Verification Code"}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Typography>Enter 6-digit verification code:</Typography>

              {timeLeft > 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Code expires in {formatTime(timeLeft)}
                </Typography>
              )}
              <Box display="flex" gap={1} justifyContent="center">
                {code.map((c, i) => (
                  <TextField
                    key={i}
                    inputRef={(el) => (inputsRef.current[i] = el)}
                    value={c}
                    onChange={(e) => handleCodeChange(e.target.value, i)}
                    inputProps={{
                      maxLength: 1,
                      sx: {
                        textAlign: "center",
                        fontSize: { xs: "1.5rem", lg: "3rem" },
                        width: { xs: '2rem', md: '3rem' },
                        height: { xs: "2rem", lg: '4rem' },
                      },
                    }}
                    sx={{ width: { xs: 45, md: 50, lg: 75 } }}
                    disabled={loading}
                  />
                ))}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Button
                  variant="contained"
                  onClick={handleVerifyCode}
                  disabled={loading || code.some(c => !c)}
                  fullWidth
                  sx={{
                    width: 200,
                    borderRadius: 1
                  }}
                >
                  {loading ? <CircularProgress size={24} /> : "Verify & Change Email"}
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => setStep(1)}
                  fullWidth
                  sx={{
                    width: 200,
                    borderRadius: 1
                  }}
                >
                  Change Email Address
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

export default RecoveryEmailView;
