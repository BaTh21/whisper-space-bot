import { useState, useRef, useEffect } from "react";
import {
    IconButton,
    Box,
    Typography
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";

export default function VoiceRecorder({ onConfirm, onRecordingChange }) {
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [seconds, setSeconds] = useState(0);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = e => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            setAudioBlob(blob);
        };

        mediaRecorderRef.current.start();
        setRecording(true);
        setSeconds(0);

        onRecordingChange?.(true);

        timerRef.current = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        clearInterval(timerRef.current);
        setRecording(false);

    };

    const cancelRecording = () => {
        setAudioBlob(null);
        setSeconds(0);

        onRecordingChange?.(false);
    };

    const sendRecording = () => {
        onConfirm(audioBlob);
        cancelRecording();

        onRecordingChange?.(false);
    };

    return (
        <>
            {!audioBlob ? (
                <IconButton
                    onClick={recording ? stopRecording : startRecording}
                    sx={{
                        bgcolor: recording ? "error.main" : "primary.main",
                        color: "white",
                        borderRadius: 2,
                        "&:hover": {
                            bgcolor: recording ? "error.dark" : "primary.dark"
                        }
                    }}
                >
                    {recording ? <StopIcon /> : <MicIcon />}
                </IconButton>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        gap: 1,
                        height: 17
                    }}
                >
                    <VoiceMessagePlayer url={URL.createObjectURL(audioBlob)} />

                    <IconButton
                        onClick={cancelRecording}
                        color="error"
                        sx={{
                            borderRadius: 2,
                            width: 40,
                            height: 40,
                            bgcolor: 'secondary.main',
                            color: 'white',
                            borderRadius: 2,
                            '&:hover': {
                                bgcolor: '#bc0948ff'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    <IconButton
                        onClick={sendRecording}
                        color="primary"
                        sx={{
                            borderRadius: 2,
                            width: 40,
                            height: 40,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 2,
                            '&:hover': {
                                bgcolor: '#213e57ff'
                            }
                        }}
                    >
                        <SendIcon />
                    </IconButton>

                </Box>
            )}

            {recording && (
                <Typography variant="caption" color="error">
                    Recording… {seconds}s
                </Typography>
            )}
        </>
    );
}
