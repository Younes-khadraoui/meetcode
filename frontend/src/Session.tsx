import { useEffect } from "react";

const Session = () => {

    useEffect(()=> {
        const socket = new WebSocket("ws://localhost:8000/ws")
        console.log(socket)
    },[])


  return <div className="p-10">
    Welcom to your session
  </div>;
};

export default Session;
