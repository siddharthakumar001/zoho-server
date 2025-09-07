import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

console.log('Setting up CORS...');

// Simple CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

console.log('Setting up middleware...');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('Setting up routes...');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

console.log('Starting server...');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
  console.log(`✅ Test at: http://localhost:${PORT}/health`);
});
