import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

const Session = () => {
  const [sessionExists, setSessionExists] = useState(true);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{
    [key: string]: MediaStream;
  }>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const currentUsername = useRef<string>("");

  const { sessionID } = useParams();

  const socketRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [key: string]: RTCIceCandidateInit[] }>(
    {}
  );

  useEffect(() => {
    currentUsername.current = createRandomYounes();
  }, []);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const getConnectedDevices = async (type: string) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === type);
  };

  const createPeerConnection = (member: string): RTCPeerConnection => {
    const peer = new RTCPeerConnection(iceServers);
    const socket = socketRef.current;

    peer.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send(
          JSON.stringify({
            type: "CANDIDATE",
            candidate: event.candidate,
            member,
            sessionID: location.pathname.substring(1),
          })
        );
      }
    };

    peer.ontrack = (event) => {
      console.log(`Track received from ${member}:`, event.streams[0]);
    
      // Ensure the stream contains valid tracks
      event.streams[0].getTracks().forEach((track) => {
        console.log(`Track type: ${track.kind}, Track readyState: ${track.readyState}`);
      });
    
      if (event.streams[0]) {
        console.log(`Adding remote stream for ${member}`);
        setRemoteStreams((prevStreams) => {
          console.log(`Updating remoteStreams for ${member}`, event.streams[0]);
          return {
            ...prevStreams,
            [member]: event.streams[0],
          };
        });
      } else {
        console.error(`No valid stream received from ${member}`);
      }
    };

    peer.onconnectionstatechange = () => {
      console.log(`Connection state with ${member}:`, peer.connectionState);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate for ${member}:`, event.candidate);
        socket?.send(
          JSON.stringify({
            type: "CANDIDATE",
            candidate: event.candidate,
            member,
            sessionID: location.pathname.substring(1),
          })
        );
      } else {
        console.log(`ICE candidate gathering complete for ${member}`);
      }
    };

    if (socket?.readyState === WebSocket.OPEN) {
      // Handle remote description setting
      socket.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        if (data.type === "ANSWER" && data.member === member) {
          await peer.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log(`Remote description set for ${member}`);
          // Add queued ICE candidates
          pendingCandidates.current[member]?.forEach((candidate) => {
            peer.addIceCandidate(new RTCIceCandidate(candidate));
          });
          delete pendingCandidates.current[member];
        } else if (data.type === "CANDIDATE" && data.member === member) {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            pendingCandidates.current[member] =
              pendingCandidates.current[member] || [];
            pendingCandidates.current[member].push(data.candidate);
          }
        }
      };
    }

    if (localStream) {
      localStream
        .getTracks()
        .forEach((track) => peer.addTrack(track, localStream));
    }

    return peer;
  };

  const handleNewMember = async (member: string) => {
    console.log(`New member detected: ${member}`);
    if (peerConnections.current[member]) {
      console.warn(`Peer connection for ${member} already exists`);
      return;
    }

    const createAndSendOffer = async () => {
      console.log(`Creating a peer connection for ${member}`);
      const peer = createPeerConnection(member);
      peerConnections.current[member] = peer;

      try {
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        console.log(`Offer created for ${member}:`, offer);
        await peer.setLocalDescription(offer);

        const socket = socketRef.current;

        if (socket?.readyState === WebSocket.OPEN) {
          const message = {
            type: "OFFER",
            offer,
            member,
            sessionID: location.pathname.substring(1),
          };
          console.log("Sending offer message:", message);
          socket.send(JSON.stringify(message));
          console.log("Offer sent successfully");
        } else {
          console.error(
            `Cannot send offer - Socket state: ${socket?.readyState}`
          );
          // If socket isn't open, retry with exponential backoff
          let retryCount = 0;
          const maxRetries = 5;
          const retryInterval = 1000;

          const retryOffer = () => {
            console.log(`Retrying offer send. Attempt ${retryCount + 1}`);
            if (socket?.readyState === WebSocket.OPEN) {
              const message = {
                type: "OFFER",
                offer,
                member,
                sessionID: location.pathname.substring(1),
              };
              socket.send(JSON.stringify(message));
              console.log("Offer sent successfully on retry");
            } else if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(
                retryOffer,
                retryInterval * Math.pow(2, retryCount - 1)
              );
              console.log(
                `Scheduling retry ${retryCount} in ${
                  retryInterval * Math.pow(2, retryCount - 1)
                }ms`
              );
            } else {
              console.error("Failed to send offer after maximum retries");
            }
          };

          setTimeout(retryOffer, retryInterval);
        }
      } catch (error) {
        console.error("Error creating/sending offer:", error);
      }
    };

    if (localStream) {
      await createAndSendOffer();
    } else {
      console.log("Waiting for local stream...");
      const checkLocalStream = setInterval(() => {
        if (localStream) {
          console.log("Local stream became available");
          createAndSendOffer();
          clearInterval(checkLocalStream);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkLocalStream);
        console.error("Timed out waiting for local stream");
      }, 10000);
    }
  };

  const handleOffer = async (
    offer: RTCSessionDescriptionInit,
    member: string
  ) => {
    console.log(`Handling offer from ${member}`, offer);
    const peer = createPeerConnection(member);
    peerConnections.current[member] = peer;

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    console.log(`Remote description set for ${member}`);

    if (pendingCandidates.current[member]) {
      console.log(`Adding queued ICE candidates for ${member}`);
      for (const candidate of pendingCandidates.current[member]) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
      delete pendingCandidates.current[member];
    }

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    console.log(`Answer created and local description set for ${member}`);


    const socket = socketRef.current;

    socket?.send(
      JSON.stringify({
        type: "ANSWER",
        answer,
        member,
        sessionID: location.pathname.substring(1),
      })
    );
  };

  const handleAnswer = async (
    answer: RTCSessionDescriptionInit,
    member: string
  ) => {
    const peer = peerConnections.current[member];
    if (!peer) return;

    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleCandidate = async (
    candidate: RTCIceCandidateInit,
    member: string
  ) => {
    const peer = peerConnections.current[member];
    if (peer?.remoteDescription) {
      console.log(`Adding ICE candidate for ${member}`);
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      console.warn(
        `Remote description not set yet for ${member}, queuing candidate`
      );
      pendingCandidates.current[member] =
        pendingCandidates.current[member] || [];
      pendingCandidates.current[member].push(candidate);
    }
  };

  useEffect(() => {
    if (!sessionExists) return;

    const setupMediaDevices = async () => {
      try {
        const [cameras, audios] = await Promise.all([
          getConnectedDevices("videoinput"),
          getConnectedDevices("audioinput"),
        ]);
        setCameraDevices(cameras);
        setAudioDevices(audios);

        if (cameras.length) {
          setSelectedCamera(cameras[0].deviceId);
        }
        if (audios.length) {
          setSelectedAudio(audios[0].deviceId);
        }

        // Get initial stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: cameras[0]?.deviceId
              ? { exact: cameras[0].deviceId }
              : undefined,
          },
          audio: {
            deviceId: audios[0]?.deviceId
              ? { exact: audios[0].deviceId }
              : undefined,
          },
        });

        setLocalStream(stream);

        const localVideo = document.querySelector(
          "video#localVideo"
        ) as HTMLVideoElement;
        if (localVideo) {
          localVideo.srcObject = stream;
        }

        // Signal that initialization is complete
        setIsInitialized(true);
      } catch (error) {
        console.error("Error setting up media devices:", error);
      }
    };

    setupMediaDevices();

    const updateDeviceLists = async () => {
      const [cameras, audios] = await Promise.all([
        getConnectedDevices("videoinput"),
        getConnectedDevices("audioinput"),
      ]);
      setCameraDevices(cameras);
      setAudioDevices(audios);
    };

    navigator.mediaDevices.addEventListener("devicechange", updateDeviceLists);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        updateDeviceLists
      );
    };
  }, [sessionExists]);

  useEffect(() => {
    if (!isInitialized || !sessionExists) return;

    let ws: WebSocket;
    const connectWebSocket = () => {
      ws = new WebSocket(`ws://localhost:8000/session/${sessionID}`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established:", sessionID);
        const msg = JSON.stringify({
          type: "JOIN_MEETING",
          member: createRandomYounes(),
          sessionID: location.pathname.substring(1),
        });
        ws.send(msg);
      };

      ws.onmessage = async (e) => {
        const message = JSON.parse(e.data);
        console.log("WebSocket message received:", message);

        switch (message.type) {
          case "OFFER":
            console.log(`Received OFFER from ${message.member}`);
            await handleOffer(message.offer, message.member);
            break;
          case "ANSWER":
            await handleAnswer(message.answer, message.member);
            break;
          case "CANDIDATE":
            await handleCandidate(message.candidate, message.member);
            break;
          case "NEW_MEMBER":
            if (message.member !== currentUsername.current) {
              await handleNewMember(message.member);
            }
            break;
          case "SESSION_NOT_FOUND":
            setSessionExists(false);
            break;
          default:
            console.warn("Unknown WebSocket message type:", message.type);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        socketRef.current = null;
        handleReconnect();
      };
    };

    connectWebSocket();

    // Add reconnection logic
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const handleReconnect = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts - 1),
          30000
        );
        setTimeout(() => {
          console.log(
            `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`
          );
          connectWebSocket();
        }, delay);
      } else {
        console.error("Max reconnection attempts reached");
        setSessionExists(false);
      }
    };

    return () => {
      ws.close();
      // Clean up any pending reconnection attempts
      reconnectAttempts = maxReconnectAttempts;
    };
  }, [sessionID, sessionExists, isInitialized]);

  useEffect(() => {
    if (!sessionExists) {
      return;
    }
    const setupLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          },
          audio: {
            deviceId: selectedAudio ? { exact: selectedAudio } : undefined,
          },
        });
        setLocalStream(stream);

        const localVideo = document.querySelector(
          "video#localVideo"
        ) as HTMLVideoElement;
        if (localVideo) {
          localVideo.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    setupLocalStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedCamera, selectedAudio, sessionExists]);

  const createRandomYounes = () => {
    let username = localStorage.getItem("username");
    if (!username) {
      username = "younes" + Math.floor(Math.random() * 100);
      localStorage.setItem("username", username);
    }
    return username;
  };

  if (!sessionExists) {
    return <div className="p-10 text-red-500">Session does not exist</div>;
  }

  return (
    <div className="p-10">
      <div>Welcome to your session</div>
      <div className="flex gap-2">
        <div>
          <p>Choose your Camera</p>
          <select
            className="text-black outline-none p-1"
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
      <div className="flex mt-10  gap-5">
        <video
          className="flex-1 bg-gray-800"
          id="localVideo"
          autoPlay
          playsInline
        />
        {Object.entries(remoteStreams).map(([member, stream]) => (
          <video
          key={member}
          className="flex-1 bg-gray-800 remote-video"
          autoPlay
          playsInline
          ref={(videoElement) => {
            if (videoElement) {
              if (!stream) {
                console.error(`No stream available for member ${member}`);
                return;
              }
              if (videoElement.srcObject !== stream) {
                console.log(`Attaching stream to video element for ${member}`);
                videoElement.srcObject = stream;
              } else {
                console.log(`Stream already attached for ${member}`);
              }
            } else {
              console.error(`Video element for ${member} is null`);
            }
          }}
        />
        ))}
      </div>
    </div>
  );
};

export default Session;
