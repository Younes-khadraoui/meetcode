import { useEffect, useState } from "react";

const Session = () => {
  const [sessionExists, setSessionExists] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Fetch connected devices of a specific type
  const getConnectedDevices = async (type: string) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === type);
  };

  // Handle WebSocket connection
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/session");

    socket.onopen = () => {
      console.log("socket opened");
      const msg = JSON.stringify({
        action: "JOIN_MEETING",
        member: createRandomYounes(),
        sessionID: location.pathname.substring(1),
      });
      socket.send(msg);
    };

    socket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      if (message.action === "JOINING_MEET") {
        console.log("New user joined the meeting");
        setSessionExists(true);
      } else if (message.action === "SESSION_NOT_FOUND") {
        setSessionExists(false);
      } else {
        console.error("Bad response from server, can't join meeting");
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      socket.close();
    };
  }, []);

  // Handle media device changes
  useEffect(() => {
    const updateDeviceLists = async () => {
      try {
        const [cameras, audios] = await Promise.all([
          getConnectedDevices("videoinput"),
          getConnectedDevices("audioinput"),
        ]);
        setCameraDevices(cameras);
        setAudioDevices(audios);
      } catch (error) {
        console.error("Error updating devices:", error);
      }
    };

    updateDeviceLists();

    const handleDeviceChange = () => {
      updateDeviceLists();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  const createRandomYounes = () => {
    const rand_num = Math.floor(Math.random() * 100);
    return "younes" + rand_num;
  };

  if (!sessionExists) {
    return <div className="p-10 text-red-500">Session does not exist</div>;
  }

  if (cameraDevices.length === 0) {
    return <div className="p-10 text-red-500">No camera detected</div>;
  }

  return (
    <div className="p-10">
      <div>Welcome to your session</div>
      <div className="flex gap-2">
        <div>
          <p>Choose your Camera</p>
          <select
            className="text-black outline-none p-1"
            name="availableCameras"
            id="availableCameras"
          >
            {cameraDevices.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p>Choose your Audio</p>
          <select
            className="text-black outline-none p-1"
            name="availableAudio"
            id="availableAudio"
          >
            {audioDevices.map((audio) => (
              <option key={audio.deviceId} value={audio.deviceId}>
                {audio.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default Session;
