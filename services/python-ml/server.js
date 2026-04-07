const express = require('express');
const cors = require('cors');

const PORT = 8081;
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MOCK_MESSAGE = 'Python ML service is running in mock mode and does not execute AI or ML workloads.';

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'python-ml',
    port: PORT,
    mock: true,
    message: MOCK_MESSAGE,
    timestamp: new Date().toISOString()
  });
});

app.all('*', (req, res) => {
  console.warn(`[PYTHON-ML] Mock service received ${req.method} ${req.originalUrl}`);
  res.status(501).json({
    error: 'not_implemented',
    message: MOCK_MESSAGE,
    service: 'python-ml',
    mock: true,
    method: req.method,
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PYTHON-ML] Mock service listening on port ${PORT}`);
});

