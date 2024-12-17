import { useEffect, useState } from "react";

function App() {
  const [ws, setWs] = useState<WebSocket>()
  const [meetURL, setMeetURL] = useState<string>("")

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws")

    socket.onopen = () => {
      console.log("socket opened");
    };

    socket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      if (message.action == "MEETING_CREATED")
        setMeetURL(message.sessionURL)
      else 
        console.error("Bad response from server cant create meeting")
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const createNewMeet = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        "action" : "CREATE_MEETING",
        "host": createRandomYounes
      }))
    }
  }

  const createRandomYounes = () => {
    const rand_num = Math.random()
    return "younes" + rand_num
  }

  return (
    <div className="p-10">
      <h1 className="text-red-100 text-xl font-semibold">
        Welcome to Meetcode
      </h1>
      <button 
          onClick={createNewMeet}
          className="bg-blue-600 px-2 py-1 rounded-sm hover:scale-105 transition-transform duration-200 outline-none">
        Create new meet
      </button>
      {
        meetURL && <p>meet create at {meetURL}</p>
      }
    </div>
  );
}

export default App;
