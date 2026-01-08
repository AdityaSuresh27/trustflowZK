# ZKPulse - Zero-Knowledge Payment Verification Voice Assistant

A blockchain-powered voice assistant that enables secure, privacy-preserving payment verification using Zero-Knowledge proofs. Built for hackathon submission with focus on UX, security, and innovation.

## Architecture

**Communication Layer** (Ears → Brain):
- Frontend: React + Web Speech API for voice recognition
- Backend: Express.js + Google Gemini AI for intelligent responses
- Real-time voice input/output with AI-powered conversation

**Trust Layer** (Blockchain + ZK):
- ZK-Circuits: Poseidon hash-based privacy-preserving PIN authentication
- Smart Contracts: Solidity verifier deployed on Polygon Amoy
- Gasless Relayer: Server-side transaction fee handling for seamless UX

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional)
- Gemini API Key (free from [Google AI Studio](https://ai.google.dev))

### Local Development

**1. Clone and Setup**
```bash
git clone <repo>
cd zkpulse
cp backend/.env.example backend/.env
# Edit backend/.env with your Gemini API key
```

**2. Start Backend**
```bash
cd backend
npm install
npm start
# Backend runs on http://localhost:5000
```

**3. Start Frontend (new terminal)**
```bash
cd frontend
npm install
npm start
# Frontend runs on http://localhost:3000
```

### Docker Setup

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

Access frontend at `http://localhost:3000`

## Project Structure

```
zkpulse/
├── backend/
│   ├── src/index.js           # Express server + Gemini integration
│   ├── package.json           # Backend dependencies
│   ├── .env.example          # Environment variables template
│   └── Dockerfile            # Backend container
├── frontend/
│   ├── src/
│   │   ├── App.js            # React voice assistant UI
│   │   └── index.js          # Entry point
│   ├── package.json          # Frontend dependencies
│   └── Dockerfile            # Frontend container
├── docker-compose.yml        # Multi-container orchestration
├── .dockerignore             # Docker build exclusions
└── README.md                 # This file
```

## Current Features

- ✅ Voice input recognition (Web Speech API)
- ✅ AI-powered responses (Google Gemini 2.5 Flash)
- ✅ Voice output synthesis
- ✅ Docker containerization
- ✅ CORS-enabled API

## Next Steps (Roadmap)

- [ ] ZK-Circuit implementation (auth.circom)
- [ ] Smart contract deployment (Polygon Amoy)
- [ ] Gasless relayer integration
- [ ] Payment status verification via Gemini tools
- [ ] Enhanced UI with conversation history
- [ ] Testing & security audit

## Environment Variables

Create `backend/.env`:
```
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.5-flash
```

## Available Scripts

**Backend:**
- `npm start` - Start Express server on port 5000

**Frontend:**
- `npm start` - Start React dev server on port 3000
- `npm build` - Build for production

## Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Docker build slow:**
```bash
docker-compose build --no-cache backend
```

**Gemini API errors:**
- Verify API key in `backend/.env`
- Check model name matches available models
- Ensure proper CORS configuration

## Tech Stack

- **Frontend**: React 18, Web Speech API
- **Backend**: Express.js, Google Generative AI
- **DevOps**: Docker, Docker Compose
- **Blockchain**: Solidity (coming soon)
- **ZK**: snarkjs, circom, Poseidon hashing (coming soon)

## License

MIT

## Contact

For hackathon inquiries, check the repository issues.
