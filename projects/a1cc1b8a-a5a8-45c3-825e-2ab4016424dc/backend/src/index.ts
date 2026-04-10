// filename: backend/src/index.ts
import express from 'express';
import bodyParser from 'body-parser';
import { configureRoutes } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

configureRoutes(app);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});