# Security Vulnerability Fixes - ZKPulse Backend

## Overview
This document details the critical security vulnerabilities that were identified and fixed in the ZKPulse backend API.

---

## Vulnerability 1: Broken Authentication & IDOR (Account Takeover)

### The Flaw
The `/api/register-pin` endpoint was publicly accessible with **no authentication or authorization checks**. An attacker could call this endpoint with any `customerId` and a new `pinHash` to overwrite a victim's PIN without needing:
- Their original PIN
- A valid login session
- Any proof of ownership

### The Exploit (BEFORE FIX)
```bash
# Attacker could easily take over any account
curl -X POST http://localhost:5000/api/register-pin \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "victim-id-123",
    "pinHash": "attacker-controlled-hash",
    "salt": "attacker-salt"
  }'
```

### The Impact
- **Account Takeover**: Overwrite victim's PIN without authorization
- **Identity Theft**: Since ZK-Proof depends on this PIN hash, attacker controls victim's identity for all future verified payments
- **Financial Loss**: Unauthorized transactions using victim's account

### The Fix
✅ **Added JWT Authentication Middleware**
- All PIN-related endpoints now require valid JWT token
- Token is obtained via `/api/login` endpoint
- Prevents unauthorized access

✅ **Added IDOR Protection (Insecure Direct Object Reference)**
- User can only modify their own `customerId`
- Request will be rejected if user tries to modify another user's data
- Server-side validation ensures user identity matches requested data

---

## Vulnerability 2: Port Conflict on macOS

### The Flaw
- Default port `5000` is blocked by macOS "AirPlay Receiver"
- Causes connection refused errors on macOS systems
- Workaround required unnecessary port changes

### The Fix
✅ **Changed Default Port to 5001**
- Avoids macOS AirPlay conflict
- Configurable via `PORT` environment variable
- Applies to all systems, not just macOS

---

## New Authentication System

### 1. Get JWT Token

**Endpoint**: `POST /api/login`

```bash
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123"
  }'
```

**Response**:
```json
{
  "status": "success",
  "message": "Authentication token generated",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customerId": "customer-123",
  "expiresIn": "24h"
}
```

### 2. Use Token in Protected Endpoints

Include the token in the `Authorization` header for all protected endpoints:

```bash
curl -X POST http://localhost:5001/api/register-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "customerId": "customer-123",
    "pinHash": "hash-value",
    "salt": "salt-value"
  }'
```

### 3. Check PIN Status (Protected)

```bash
curl -X GET http://localhost:5001/api/check-pin/customer-123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Protected Endpoints

The following endpoints now require JWT authentication and IDOR protection:

| Endpoint | Method | Protection | Notes |
|----------|--------|-----------|-------|
| `/api/register-pin` | POST | ✅ Auth + IDOR | Must use own customerId |
| `/api/check-pin/:customerId` | GET | ✅ Auth + IDOR | Can only check own PIN |

---

## Environment Configuration

### Backend .env Example

```env
# JWT Secret (MUST be changed in production)
JWT_SECRET=your-super-secret-key-change-this-in-production

# Server Port (changed from 5000 to 5001)
PORT=5001

# Polygon RPC URL
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology

# Optional API Keys
GEMINI_API_KEY=your-gemini-api-key-here
POLYGONSCAN_API_KEY=your-polygonscan-api-key-here
```

### Generate Secure JWT Secret

For production, generate a strong random secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

---

## Migration Guide

### For Frontend Users

1. **Before making any PIN-related request**, authenticate first:
```javascript
// Step 1: Login
const loginResponse = await fetch('http://localhost:5001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customerId: 'customer-123' })
});

const { token } = await loginResponse.json();

// Step 2: Use token for subsequent requests
const pinResponse = await fetch('http://localhost:5001/api/register-pin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    customerId: 'customer-123',
    pinHash: 'hash-value',
    salt: 'salt-value'
  })
});
```

2. **Update API endpoints** from port `5000` to `5001`:
```javascript
// BEFORE
const apiUrl = 'http://localhost:5000/api/...';

// AFTER
const apiUrl = 'http://localhost:5001/api/...';
```

3. **Store and reuse tokens** with appropriate expiry handling:
```javascript
// Token expires in 24 hours
// Implement refresh logic if needed
```

---

## Security Best Practices

### ✅ DO:
- Change `JWT_SECRET` to a strong random value in production
- Store tokens securely on the client (e.g., secure HTTP-only cookies)
- Implement token refresh logic for long sessions
- Use HTTPS in production (not HTTP)
- Rotate tokens periodically
- Log authentication attempts for security monitoring

### ❌ DON'T:
- Commit real `JWT_SECRET` to version control
- Expose tokens in URLs or logs
- Share tokens between users
- Use weak/default secrets
- Store tokens in localStorage (vulnerable to XSS)
- Skip token validation on protected endpoints

---

## Testing the Fixes

### 1. Test IDOR Protection

```bash
# Get token for customer-123
TOKEN=$(curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{"customerId": "customer-123"}' | jq -r '.token')

# Try to register PIN for different customer (should fail)
curl -X POST http://localhost:5001/api/register-pin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "customer-456",
    "pinHash": "hash-value",
    "salt": "salt-value"
  }'

# Expected: 403 Forbidden - Access denied
```

### 2. Test Authentication Requirement

```bash
# Try to call register-pin without token (should fail)
curl -X POST http://localhost:5001/api/register-pin \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "pinHash": "hash-value",
    "salt": "salt-value"
  }'

# Expected: 401 Unauthorized - No authentication token provided
```

### 3. Test Port Change

```bash
# Old port (should fail)
curl http://localhost:5000/api/health
# Expected: Connection refused

# New port (should succeed)
curl http://localhost:5001/api/health
# Expected: 200 OK
```

---

## Vulnerability Summary

| Vulnerability | Severity | Status | Impact |
|---------------|----------|--------|--------|
| Broken Authentication (Account Takeover) | 🔴 CRITICAL | ✅ FIXED | Previously allowed unauthorized PIN changes |
| IDOR (Cross-user Data Access) | 🔴 CRITICAL | ✅ FIXED | Previously allowed access to other users' data |
| Port Conflict (macOS) | 🟡 MEDIUM | ✅ FIXED | Now compatible with macOS AirPlay |

---

## Questions or Issues?

If you encounter any authentication issues:

1. Verify JWT_SECRET is set in .env
2. Check that token is included in Authorization header
3. Ensure token hasn't expired (valid for 24 hours)
4. Verify customerId matches in URL/body parameters
5. Check server logs for detailed error messages

---

**Last Updated**: January 2026
**Version**: 1.0 (Post-Security-Fix)
