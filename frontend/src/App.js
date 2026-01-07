import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

function App() {
  const [message, setMessage] = useState("Connecting to backend...");

  useEffect(() => {
    // Connect to backend root endpoint
    fetch("http://localhost:5000/")
      .then((res) => res.text())
      .then((data) => setMessage(data))
      .catch(() => setMessage("Could not connect to backend."));

    // Connect to backend via Socket.IO
    const socket = io("http://localhost:5000");
    socket.on("connect", () => {
      console.log("Connected to backend via Socket.IO");
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h1>zkpulse Frontend</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;