import React, { useState } from 'react';

function App() {
  const [response, setResponse] = useState("Click the button and say 'Check my payment of 500 rupees'");

  const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      
      // Send voice text to our Docker Backend
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      // Speak the answer back
      const speech = new SpeechSynthesisUtterance(data.reply);
      window.speechSynthesis.speak(speech);
      setResponse(data.reply);
    };
    recognition.start();
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>ZKPulse Voice Assistant</h1>
      <button onClick={startListening} style={{ padding: '20px', fontSize: '20px' }}>
        🎤 Talk to Assistant
      </button>
      <p>{response}</p>
    </div>
  );
}

export default App;