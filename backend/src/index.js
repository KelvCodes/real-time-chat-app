;

import rateLimit from "express-rate-limit"; // Rate limiting
import compression from "compression"; // Response compression

// Import custom modules
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

// Load environment variables from .env file
dotenv.config();

// Define constants
const PORT = process.env.PORT || 5000; // Default to 5000 if PORT is not set
const __dirname = path.resolve();
const isProduction = process.env.NODE_ENV === "production";

// Configure rate limiter to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Initialize Express application
// app is imported from socket.js where it's already initialized
// const app = express();

// Middleware setup
// Enable compression to reduce response size
app.use(compression());

// Set security headers using helmet
app.use(helmet());

// Enable CORS with specific configuration
app.use(
  cors({
    origin: isProduction
      ? process.env.CLIENT_URL // Use production URL
      : "http://localhost:5173", // Use development URL
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);

// Parse JSON request bodies
app.use(express.json({ limit: "10kb" })); // Limit payload size for security

// Parse cookies
app.use(cookieParser());

// Log HTTP requests in development mode
if (!isProduction) {
  app.use(morgan("dev"));
}

// Apply rate limiting
app.use(limiter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
    uptime: process.uptime(),
  });
});

// Route handlers
app.use("/api/auth", authRoutes); // Authentication routes
app.use("/api/messages", messageRoutes); // Message-related routes

// Serve static files in production
if (isProduction) {
  // Serve frontend build files
  const frontendPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendPath));

  // Handle SPA routing - serve index.html for all non-API routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log error for debugging
  res.status(err.status || 500).json({
    status: "error",
    message: isProduction ? "Something went wrong!" : err.message,
  });
});

// Handle 404 - Route not found
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `Cannot find ${req.originalUrl} on this server!`,
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Connect to database
  connectDB()
    .then(() => console.log("Database connection established"))
    .catch((err) => {
      console.error("Database connection failed:", err);
      process.exit(1); // Exit process on DB connection failure
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});
