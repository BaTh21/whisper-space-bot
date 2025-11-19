import { useCallback, useEffect, useRef, useState } from 'react';

export const useVoiceMessage = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingVolume, setRecordingVolume] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const volumeIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const cleanupRecordingResources = useCallback(() => {
    console.log('Cleaning up recording resources...');
    
    // Stop and clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop and clear volume interval
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      audioContextRef.current = null;
    }
    
    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Reset volume
    setRecordingVolume(0);
  }, []);

const startRecording = useCallback(async () => {
  try {
    console.log('🎤 useVoiceMessage: Starting recording...');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Voice recording not supported in this browser');
    }

    // Get audio stream
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1
      } 
    });

    console.log('🎤 Microphone access granted, stream:', stream);
    streamRef.current = stream;

    // Test if we can actually hear the recording
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    // Create media recorder with proper MIME type fallback
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';

    console.log('🎤 Using MIME type:', mimeType);

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    });

    // Reset audio chunks
    audioChunksRef.current = [];
    
    // Handle data available event
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        console.log('📦 Data available, size:', event.data.size);
        audioChunksRef.current.push(event.data);
      }
    };

    // Handle recording stop
    recorder.onstop = () => {
      console.log('⏹️ Recording stopped, total chunks:', audioChunksRef.current.length);
      const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
      console.log('📦 Total audio data size:', totalSize, 'bytes');
      
      cleanupRecordingResources();
    };

    // Handle recording errors
    recorder.onerror = (event) => {
      console.error('❌ MediaRecorder error:', event);
      setIsRecording(false);
      cleanupRecordingResources();
    };

    mediaRecorderRef.current = recorder;
    
    // Start recording with timeslice to ensure regular data chunks
    recorder.start(1000); // Collect data every second
    setIsRecording(true);
    setRecordingTime(0);
    setRecordingVolume(0);
    
    console.log('✅ useVoiceMessage: Recording started successfully');

    // Start volume monitoring
    if (analyserRef.current) {
      volumeIntervalRef.current = setInterval(() => {
        try {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const volume = Math.min(average / 128, 1);
          setRecordingVolume(volume);
          
          // Log volume occasionally for debugging
          if (Math.random() < 0.1) { // 10% chance to log
            console.log('📊 Volume level:', volume);
          }
        } catch (error) {
          console.warn('Volume calculation error:', error);
        }
      }, 100);
    }
    
    // Start timer
    let seconds = 0;
    timerRef.current = setInterval(() => {
      seconds++;
      setRecordingTime(seconds);
      console.log('⏰ Hook timer:', seconds, 'seconds');
      
      if (seconds >= 300) {
        console.log('🕒 Auto-stopping recording after 5 minutes');
        stopRecording();
      }
    }, 1000);

  } catch (error) {
    console.error('❌ useVoiceMessage: Recording failed:', error);
    cleanupRecordingResources();
    throw error;
  }
}, [cleanupRecordingResources]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        console.log('Stopping recording...');
        
        // Set up the stop handler before stopping
        mediaRecorderRef.current.onstop = () => {
          console.log('MediaRecorder stopped, processing audio chunks...');
          
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorderRef.current.mimeType || 'audio/webm' 
          });
          
          console.log('Audio blob created:', {
            size: audioBlob.size,
            type: audioBlob.type,
            duration: recordingTime
          });

          // Cleanup resources
          cleanupRecordingResources();
          
          setIsRecording(false);
          resolve(audioBlob);
        };

        // Stop the recording
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.error('Error stopping recorder:', error);
          cleanupRecordingResources();
          setIsRecording(false);
          resolve(null);
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
          });
        }
      } else {
        console.log('No active recording to stop');
        resolve(null);
      }
    });
  }, [isRecording, recordingTime, cleanupRecordingResources]);

  const cancelRecording = useCallback(() => {
    console.log('Canceling recording...');
    
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Error canceling recorder:', error);
      }
    }
    
    cleanupRecordingResources();
    setIsRecording(false);
    setRecordingVolume(0);
    setRecordingTime(0);
    audioChunksRef.current = [];
  }, [isRecording, cleanupRecordingResources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        cancelRecording();
      }
      cleanupRecordingResources();
    };
  }, [isRecording, cancelRecording, cleanupRecordingResources]);

  return {
    isRecording,
    recordingTime,
    recordingVolume,
    startRecording,
    stopRecording,
    cancelRecording
  };
};

export default useVoiceMessage;