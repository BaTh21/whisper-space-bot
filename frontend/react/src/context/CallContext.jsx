import { createContext, useContext, useRef, useState } from "react";

const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const localStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const [callStatus, setCallStatus] = useState(null);

  const startCall = async (users) => { /* WebRTC logic */ };
  const acceptCall = async (caller) => { /* WebRTC logic */ };
  const leaveCall = () => { /* WebRTC cleanup */ };

  return (
    <CallContext.Provider value={{
      localStreamRef,
      remoteStreamsRef,
      callStatus,
      startCall,
      acceptCall,
      leaveCall,
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
