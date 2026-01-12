import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route for testing
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Empowered Learnings V2 API' });
});

export default app;
