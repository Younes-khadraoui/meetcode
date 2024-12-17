import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [data, setData] = useState("")
  const [ws , setWs] = useState<WebSocket>()
  const [input, setInput] = useState("");

  useEffect(() => {
    axios.get("http://localhost:8000/")
      .then(res => {
           setData(res.data)
      })
      .catch(err => {
        console.error(err)
      })
  },[])

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws")

    socket.onopen = () => {
      console.log("socket opened")
    }

    socket.onmessage = (event) => {
      console.log("Message received:", event.data);
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
  },[])

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(input);
      setInput("");
    } else {
      console.log("WebSocket is not open");
    }
  };



  return (
    <div className='p-10'>
      <p className=''>{data}</p>
      <h1 className='text-red-100 text-xl font-semibold' >Welcome to Meetcode</h1>
      <button className='bg-blue-600 px-2 py-1 rounded-sm hover:scale-105 transition-transform duration-200 outline-none'>Create new meet</button>
      <div>
      <h1>WebSocket Test</h1>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message"
        className='text-black'
      />
      <button onClick={sendMessage}>Send</button>
    </div>
    </div>
  )
}

export default App
