import { useEffect, useRef } from "react";

export default function RemoteVideo ({ stream, width, height })  {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={false}
      style={{
        width,
        height,
        objectFit: 'cover',
        transition: 'opacity 0.3s',
        opacity: stream ? 1 : 0
      }}
    />
  );
};
