import express from "express";
import dotenv from "dotenv";
import routes from "./src/routes/index.js";
import { startSchedulers } from "./src/jobs/scheduler.js";
import cookieParser from "cookie-parser";
import zohoRoutes from "./src/routes/zohoRoutes.js";
import cors from "cors";
import { errorHandler, notFound } from "./src/middlewares/errorMiddleware.js";

dotenv.config();

const app = express();

// CORS configuration - MUST come before other middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check - Request origin:', origin);
    
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      console.log('CORS allowing request with no origin');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      'https://127.0.0.1:3000',
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    console.log('Allowed origins:', allowedOrigins);
    
    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocking origin:', origin);
      // For development, temporarily allow all origins
      console.log('Temporarily allowing all origins for debugging');
      callback(null, true); // Change to callback(new Error('Not allowed by CORS')) for production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control'
  ],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Add explicit OPTIONS handler
app.options('*', cors());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use("/", routes);
app.use("/api/zoho-routes", zohoRoutes);

// Error handling middleware (MUST come after routes)
app.use(notFound);
app.use(errorHandler);

// Start schedulers
startSchedulers().catch((e) => console.error("Scheduler start error:", e.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on :${PORT}`);
  console.log(`CLIENT_URL: ${process.env.CLIENT_URL}`);
  console.log(`MONGO_URI: ${process.env.MONGO_URI}`);
});