# Authentication Middleware

This directory contains authentication middleware for the application.

## Available Middleware

### authMiddleware
**Purpose:** Protects admin routes by verifying user session  
**Requirements:** 12.4, 16.1  
**Usage:**
```typescript
import { authMiddleware } from './middleware/authMiddleware.js';

// Apply to admin routes
router.get('/admin/dashboard', authMiddleware, (req, res) => {
  // Only authenticated users can access this
});
```

### apiKeyAuth
**Purpose:** Protects integration endpoints by verifying API key  
**Requirements:** 16.2, 16.3  
**Usage:**
```typescript
import { apiKeyAuth } from './middleware/apiKeyAuth.js';

// Apply to integration routes
router.post('/api/integrations/coupons/consume', apiKeyAuth, (req, res) => {
  // Only requests with valid API key can access this
  // req.apiClient will be set to 'n8n' for logging
});
```

**Configuration:**
Set `N8N_API_KEY` in `.env` file:
```bash
# Generate with: openssl rand -base64 32
N8N_API_KEY=your-secure-random-key-here
```

**Request Format:**
```bash
curl -X POST http://localhost:3001/api/integrations/coupons/consume \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+905551234567", "token": "ABC123DEF456"}'
```

## Error Responses

### authMiddleware
- **401 Unauthorized:** User not authenticated (no valid session)

### apiKeyAuth
- **401 MISSING_API_KEY:** Authorization header not provided
- **401 INVALID_AUTH_FORMAT:** Authorization header format is incorrect
- **401 INVALID_API_KEY:** API key does not match configured value
- **500 SERVER_MISCONFIGURATION:** N8N_API_KEY not configured in environment

## Testing

Both middleware have comprehensive test coverage:
- `authMiddleware`: Tested via integration tests in routes
- `apiKeyAuth`: Unit tests in `apiKeyAuth.test.ts`

Run tests:
```bash
npm run test apiKeyAuth.test.ts
```
