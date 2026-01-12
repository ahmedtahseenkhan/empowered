"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env vars
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const tutorRoutes_1 = __importDefault(require("./routes/tutorRoutes"));
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/auth', authRoutes_1.default);
app.use('/api/tutor', tutorRoutes_1.default);
// Health Check
app.get('/', (req, res) => {
    res.send('Empowered Learnings API v2 is running');
});
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
