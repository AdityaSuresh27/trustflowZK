const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Define the Tool (The "Arms")
const tools = [
  {
    functionDeclarations: [{
      name: "checkPaymentStatus",
      description: "Checks the blockchain for a specific payment amount.",
      parameters: {
        type: "OBJECT",
        properties: { amount: { type: "NUMBER" } },
        required: ["amount"]
      }
    }]
  }
];

// 2. The AI Agent Route
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const result = await model.generateContent(message);
    const response = result.response;
  
    res.json({ reply: response.text() });
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    res.status(500).json({ reply: 'Sorry, I encountered an error. Please try again.' });
  }
});

app.listen(5000, () => console.log('ZKPulse Brain active on Port 5000'));