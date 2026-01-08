# Development Guide

## Setting Up for ZK Development

### Install Global Tools

```bash
npm install -g snarkjs@0.7.5
```

### ZK Circuit Compilation (Next Steps)

1. Create `zk/auth.circom` with PIN authentication logic
2. Compile circuit: `circom zk/auth.circom --r1cs --wasm`
3. Generate proving key: `snarkjs groth16 setup circuit.r1cs powersoftau.ptau circuit_final.zkey`
4. Export verifier: `snarkjs zkey export solidityverifier circuit_final.zkey Verifier.sol`

### Backend Enhancements

- Add payment verification tool to Gemini
- Integrate Web3.js for contract interactions
- Implement gasless relayer pattern

### Frontend Enhancements

- Add conversation history panel
- Implement payment input UI
- Add proof generation workflow

## Debugging

**Check backend logs:**
```bash
cd backend && node src/index.js
```

**Check frontend dev server:**
```bash
cd frontend && npm start
```

**Docker logs:**
```bash
docker logs zkpulse-backend-1
docker logs zkpulse-frontend-1
```

## Testing Voice Assistant

1. Open http://localhost:3000
2. Click microphone button
3. Speak a query (e.g., "What is ZKPulse?")
4. Listen for AI response
5. Check backend terminal for Gemini logs

## Code Quality

- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Test locally before pushing
- Avoid committing `.env` or build artifacts

## Common Issues

| Issue | Solution |
|-------|----------|
| Port in use | Kill process: `lsof -ti:5000 \| xargs kill -9` |
| Module not found | Run `npm install` in the relevant directory |
| Gemini 404 error | Verify API key and model name in `.env` |
| Docker build slow | Use `--no-cache` flag |

## Next Milestone

- Implement ZK authentication circuit
- Deploy to Polygon Amoy testnet
- Integration testing with Gemini tools
