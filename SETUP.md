# Zoho Server Backend Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB running locally
- npm or yarn package manager

### 2. Installation & Setup

```bash
# Install dependencies
npm install

# Start MongoDB (if not running)
brew services start mongodb-community

# Create admin user (run once)
npm run create-admin

# Start the backend server
npm start
```

### 3. Verify Setup

```bash
# Test if backend is working
npm run test-backend

# Check if admin user exists
npm run check-user
```

## Environment Configuration

Your `.env` file should contain:
```properties
PORT=5000
CLIENT_URL=http://localhost:3000
MONGO_URI=mongodb://localhost:27017/test
JWT_SECRET="8a34F$k90!Lms_23XjZwqTrg@E9bLmAa"
```

## API Endpoints

### Authentication
- `POST /api/sales/auth/login` - Login with email/password
- `GET /api/sales/auth/me` - Get current user info
- `POST /api/sales/auth/logout` - Logout

### Test Endpoints
- `GET /health` - Health check
- `GET /api/admin/sales-members` - List sales members (requires auth)

## Frontend Integration

### CORS Configuration
The backend is configured to accept requests from:
- `http://localhost:3000` (your frontend)
- `http://127.0.0.1:3000`

### Frontend API Configuration
Configure your frontend to connect to:
```javascript
const API_BASE_URL = 'http://localhost:5000';
```

### Example Frontend Login Request
```javascript
fetch('http://localhost:5000/api/sales/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'admin@gmail.com',
    password: 'Admin@123'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Login successful:', data);
  // Store token if needed
  localStorage.setItem('token', data.accessToken);
})
.catch(error => {
  console.error('Login failed:', error);
});
```

### Making Authenticated Requests
```javascript
fetch('http://localhost:5000/api/admin/sales-members', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
```

## Troubleshooting

### Backend Won't Start
1. Check if MongoDB is running: `brew services start mongodb-community`
2. Check if port 5000 is available: `lsof -i :5000`
3. Check environment variables: `cat .env`

### CORS Errors
1. Verify frontend URL matches `CLIENT_URL` in `.env`
2. Check browser console for specific CORS errors
3. Ensure `credentials: 'include'` in frontend requests

### Login Fails
1. Verify admin user exists: `npm run check-user`
2. Test login directly: 
   ```bash
   curl -X POST http://localhost:5000/api/sales/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@gmail.com","password":"Admin@123"}'
   ```

### Database Issues
1. Check MongoDB connection: `mongosh mongodb://localhost:27017/test`
2. Verify collections exist: `show collections`
3. Check admin user: `db.salesmembers.findOne({email: "admin@gmail.com"})`

## Useful Scripts

- `npm start` - Start the backend server
- `npm run dev` - Start with nodemon (auto-restart)
- `npm run test-backend` - Comprehensive backend test
- `npm run create-admin` - Create default admin user
- `npm run check-user` - Verify admin user exists
- `./start.sh` - Guided startup script

## Default Admin Credentials

- Email: `admin@gmail.com`
- Password: `Admin@123`

## Support

If you encounter issues:
1. Run `npm run test-backend` to diagnose problems
2. Check server logs in terminal
3. Verify all environment variables are set correctly
4. Ensure MongoDB is running and accessible
