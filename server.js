import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import userRouter from './routes/user.routes.js';
import adminRouter from './routes/admin.routes.js';
import publicRouter from './routes/public.routes.js';
import mediaRouter from './routes/media.routes.js';
import blogRoutes from './routes/blog.routes.js';
import blogCategoryRoutes from './routes/blogCategory.routes.js';
import itCategoryRoutes from './routes/itCategory.routes.js';
import path from 'path';
import fs from 'fs';
import projectRoutes from './routes/package.routes.js';
import flightRoutes from './routes/flightRoutes.js';
import hotelRoutes from './routes/hotelRoutes.js';
import faqsRoutes from './routes/faqs.routes.js';
import dynamicFieldRoutes from './routes/dynamicField.routes.js';
import cabRoutes from './routes/cab.routes.js';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 3000;


// CORS Configuration
const allowedOrigins = [
  'http://82.112.236.83',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, allow requests with or without origin (like Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    const allowed = allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      origin.includes(allowedOrigin) ||
      origin.startsWith(`http://${allowedOrigin}`) || 
      origin.startsWith(`https://${allowedOrigin}`)
    );
    
    if (allowed) {
      return callback(null, true);
    }
    
    console.log('Blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'X-XSRF-TOKEN'
  ],
  exposedHeaders: [
    'Set-Cookie',
    'Authorization'
  ],
  optionsSuccessStatus: 200
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// Other middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.use('/api/v1/blog-categories', blogCategoryRoutes);
app.use('/api/v1/it-categories', itCategoryRoutes);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/blog', blogRoutes);

app.use('/api/v1', publicRouter);
app.use('/api/v1/packages', projectRoutes);
app.use('/api/v1/flights', flightRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/faqs', faqsRoutes);
app.use('/api/v1/admin', dynamicFieldRoutes);
app.use('/api/v1/admin/cabs', cabRoutes);
app.use('/api/v1/cabs', cabRoutes);

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory at: ${uploadsDir}`);
} else {
  console.log(`Uploads directory exists at: ${uploadsDir}`);
}

// Log the contents of the uploads directory
fs.readdir(uploadsDir, (err, files) => {
  if (err) {
    console.error('Error reading uploads directory:', err);
    return;
  }
  console.log('Files in uploads directory:', files);
});

// Serve static files from uploads directory with proper caching
app.use('/uploads', express.static(uploadsDir, {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// Debug route to check file access
app.get('/check-upload/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(404).json({
        status: 'error',
        message: 'File not found',
        path: filePath,
        exists: fs.existsSync(filePath)
      });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the Portfolio API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    documentation: '/api/v1/docs' // Will be added later with Swagger
  });
});

// 404 handler for unhandled routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  res.status(statusCode).json({
    status,
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      stack: err.stack
    })
  });
};

// Use error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.log('UNHANDLED REJECTION! 💥 Shutting down...');
      console.log(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
      console.log(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      server.close(() => {
        console.log('💥 Process terminated!');
      });
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

// Start the server
startServer();
