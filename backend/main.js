import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { testRedisConnection, testSupabaseConnection } from './utils/index.js';
import dataRoutes from './routes/dataRoutes.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', dataRoutes);

// Root / Health Check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Triage System API is online',
    timestamp: new Date().toISOString(),
  });
});

// Start the Express server and connect to services
const startServer = async () => {
  try {
    // Initialize DB/Redis connections
    await testRedisConnection();
    await testSupabaseConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Server is listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
