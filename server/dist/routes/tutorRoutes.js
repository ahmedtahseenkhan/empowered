"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tutorController_1 = require("../controllers/tutorController");
const authMiddleware_1 = require("../middleware/authMiddleware"); // Assuming mock or real middleware
const router = express_1.default.Router();
// Public
router.get('/categories', tutorController_1.getCategories);
// Protected (Tutor)
router.get('/me', authMiddleware_1.authenticateToken, tutorController_1.getProfile);
router.put('/me/bio', authMiddleware_1.authenticateToken, tutorController_1.updateBio);
router.put('/me/education', authMiddleware_1.authenticateToken, tutorController_1.updateEducation);
router.put('/me/services', authMiddleware_1.authenticateToken, tutorController_1.updateServices);
router.put('/me/pricing', authMiddleware_1.authenticateToken, tutorController_1.updatePricing);
router.put('/me/external-reviews', authMiddleware_1.authenticateToken, tutorController_1.updateExternalReviews);
exports.default = router;
