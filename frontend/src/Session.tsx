import { useEffect, useState } from "react";

const Session = () => {
    const [sessionExists, setSessionExists] = useState(false)

    useEffect(() => {
      const socket = new WebSocket("ws://localhost:8000/session");

      socket.onopen = () => {
        console.log("socket opened");
        const msg = JSON.stringify({
          "action" : "JOIN_MEETING",
          "member": createRandomYounes(),
          "sessionID": location.pathname.substring(1)
        })
        socket.send(msg)
     };
  
      socket.onmessage = (e) => {
        const message = JSON.parse(e.data);
         if (message.action == "JOINING_MEET"){
            console.log("New user joined the meeting")
            setSessionExists(true);
          }
        else
          if (message.action == "SESSION_NOT_FOUND")
            setSessionExists(false)
        else
          console.error("Bad response from server cant join meeting")
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


  const createRandomYounes = () => {
    const rand_num = Math.floor(Math.random() * 100)
    return "younes" + rand_num
  }

  if (!sessionExists) {
    return <div className="p-10 text-red-500">
      Session does not exist
    </div>;
  }

  return <div className="p-10">
    Welcom to your session
  </div>;
};

export default Session;
