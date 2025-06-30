
// Importing core dependencies for the Express server and utilities
import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

// Importing custom modules for database and routing
import { connectDB } from './lib/db';
import authRoutes from './routes/auth.route';
import messageRoutes from './routes/message.route';
import { socketServer } from './lib/socket';

// Load environment variables from .env file
dotenv.config();

// Define interface for server configuration
interface ServerConfig {
  port: number; // Server port number
  clientUrl: string; // Client application URL
  isProduction: boolean; // Production environment flag
  staticPath: string; // Path to static files
}

// Main Server class to encapsulate application logic
class Server {
  private app: Application; // Express application instance
  private server: ReturnType<typeof socketServer>; // Socket server instance
  private config: ServerConfig; // Server configuration object

  constructor() {
    // Initialize Express app and socket server
    this.app = express();
    this.server = socketServer(this.app);
    
    // Configure server settings
    this.config = {
      port: parseInt(process.env.PORT || '5000', 10), // Default port 5000
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173', // Default client URL
      isProduction: process.env.NODE_ENV === 'production', // Check if in production
      staticPath: path.join(__dirname, '../../frontend/dist'), // Path to frontend build
    };

    // Setup middleware, routes, and error handling
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  // Configure middleware stack for the server
  private initializeMiddleware(): void {
    // Enable response compression to reduce bandwidth
    this.app.use(compression());

    // Add security headers using Helmet
    this.app.use(helmet());

    // Configure CORS for cross-origin requests
    this.app.use(
      cors({
        origin: this.config.isProduction ? this.config.clientUrl : 'http://localhost:5173',
        credentials: true, // Allow cookies to be sent
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
        allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
      })
    );

    // Parse incoming JSON requests with size limit
    this.app.use(express.json({ limit: '10kb' }));

    // Parse cookies from incoming requests
    this.app.use(cookieParser());

    // Enable request logging in development mode
    if (!this.config.isProduction) {
      this.app.use(morgan('dev'));
    }

    // Apply rate limiting to prevent abuse
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15-minute window
        max: 100, // Maximum 100 requests per IP
        message: 'Too many requests from this IP, please try again later.',
      })
    );

    // Serve static files in production
    if (this.config.isProduction) {
      this.app.use(express.static(this.config.staticPath));
    }
  }

  // Setup API routes and endpoints
  private initializeRoutes(): void {
    // Health check endpoint for monitoring
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        uptime: process.uptime(), // Server uptime in seconds
      });
    });

    // Mount authentication and message routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/messages', messageRoutes);

    // Serve SPA in production for all unmatched routes
    if (this.config.isProduction) {
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(this.config.staticPath, 'index.html'));
      });
    }
  }

  // Configure error handling middleware
  private initializeErrorHandling(): void {
    // Handle 404 errors for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: `Cannot find ${req.originalUrl} on this server!`,
      });
    });

    // Global error handler for catching all errors
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(err.stack); // Log error stack trace
      res.status(500).json({
        status: 'error',
        message: this.config.isProduction ? 'Something went wrong!' : err.message,
      });
    });
  }

  // Start the server and connect to database
  public start(): void {
    this.server.listen(this.config.port, async () => {
      console.log(`Server running on port: ${this.config.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

      try {
        await connectDB(); // Attempt database connection
        console.log('Database connection established');
      } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1); // Exit on database connection failure
      }
    });
  }

  // Handle uncaught process errors
  private handleProcessErrors(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1); // Exit process on uncaught exception
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      this.server.close(() => process.exit(1)); // Close server and exit
    });
  }

  // Initialize and run the server
  public run(): void {
    this.handleProcessErrors();
    this.start();
  }
}

// Create and run the server instance
const serverInstance = new Server();
serverInstance.run();
