

    }

    // Apply rate limiting
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per IP
        message: 'Too many requests from this IP, please try again later.',
      })
    );

    // Serve static files in production
    if (this.config.isProduction) {
      this.app.use(express.static(this.config.staticPath));
    }
  }

  // Configure routes
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        uptime: process.uptime(),
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/messages', messageRoutes);

    // Serve SPA in production
    if (this.config.isProduction) {
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(this.config.staticPath, 'index.html'));
      });
    }
  }

  // Configure error handling
  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: `Cannot find ${req.originalUrl} on this server!`,
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(err.stack);
      res.status(500).json({
        status: 'error',
        message: this.config.isProduction ? 'Something went wrong!' : err.message,
      });
    });
  }

  // Start the server
  public start(): void {
    this.server.listen(this.config.port, async () => {
      console.log(`Server running on port: ${this.config.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

      try {
        await connectDB();
        console.log('Database connection established');
      } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
      }
    });
  }

  // Handle process errors
  private handleProcessErrors(): void {
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      this.server.close(() => process.exit(1));
    });
  }

  // Initialize and run the server
  public run(): void {
    this.handleProcessErrors();
    this.start();
  }
}

// Create and run the server
const serverInstance = new Server();
serverInstance.run();

