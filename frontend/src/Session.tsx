import { useEffect, useState } from "react";

const Session = () => {
  const [sessionExists, setSessionExists] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");

  const getConnectedDevices = async (type: string) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === type);
  };

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/session");

    socket.onopen = () => {
      console.log("Socket opened");
      const msg = JSON.stringify({
        action: "JOIN_MEETING",
        member: createRandomYounes(),
        sessionID: location.pathname.substring(1),
      });
      socket.send(msg);
    };

    socket.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.action === "JOINING_MEET") {
          console.log("New user joined the meeting");
          setSessionExists(true);
        } else if (message.action === "SESSION_NOT_FOUND") {
          setSessionExists(false);
        } else {
          console.error("Unexpected server response:", message);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
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

  useEffect(() => {
    const updateDeviceLists = async () => {
      try {
        const [cameras, audios] = await Promise.all([
          getConnectedDevices("videoinput"),
          getConnectedDevices("audioinput"),
        ]);
        setCameraDevices(cameras);
        setAudioDevices(audios);

        if (cameras.length > 0) {
          setSelectedCamera(cameras[0].deviceId);
        }
        if (audios.length > 0) {
          setSelectedAudio(audios[0].deviceId);
        }
      } catch (error) {
        console.error("Error updating device lists:", error);
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

  useEffect(() => {
    const openCamera = async (cameraId: string, minWidth: number, minHeight: number) => {
      try {
        const constraints = {
          audio: { deviceId: selectedAudio ? { exact: selectedAudio } : undefined },
          video: {
            deviceId: cameraId,
            width: { min: minWidth },
            height: { min: minHeight },
          },
        };
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        console.error("Error opening camera:", error);
        throw error;
      }
    };

    const playVideoFromCamera = async () => {
      try {
        if (selectedCamera) {
          console.log("Playing video from camera:", selectedCamera);
          const stream = await openCamera(selectedCamera, 1280, 720);
          const videoElement = document.querySelector(
            "video#localVideo"
          ) as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = stream;
          }
        }
      } catch (error) {
        console.error("Error playing video from camera:", error);
      }
    };

    playVideoFromCamera();
  }, [selectedCamera, selectedAudio]);

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

  if (audioDevices.length === 0) {
    return <div className="p-10 text-red-500">No audio device detected</div>;
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
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
          >
            {cameraDevices.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || "Unnamed Camera"}
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
            value={selectedAudio}
            onChange={(e) => setSelectedAudio(e.target.value)}
          >
            {audioDevices.map((audio) => (
              <option key={audio.deviceId} value={audio.deviceId}>
                {audio.label || "Unnamed Audio Device"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <video className="py-2" id="localVideo" autoPlay playsInline controls={false} />
    </div>
  );
};

export default Session;
