
  // Start the server

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

