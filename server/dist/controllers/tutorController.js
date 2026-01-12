"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExternalReviews = exports.getCategories = exports.updatePricing = exports.updateServices = exports.updateEducation = exports.updateBio = exports.getProfile = void 0;
const db_1 = __importDefault(require("../config/db"));
// Get Full Profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const profile = await db_1.default.tutorProfile.findUnique({
            where: { user_id: userId },
            include: {
                categories: {
                    include: { category: true }
                },
                education: true,
                experience: true,
                certifications: true,
                languages: true,
                availabilities: true,
                external_reviews: true
            }
        });
        if (!profile)
            return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    }
    catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getProfile = getProfile;
// Update Bio Section (Basic Info, Intro, Media)
const updateBio = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { tagline, about, country, video_url, profile_photo, key_strengths, languages } = req.body;
        const updatedProfile = await db_1.default.tutorProfile.update({
            where: { user_id: userId },
            data: {
                tagline,
                about,
                country,
                video_url,
                key_strengths, // Assuming string
                // Note: profile_photo is usually handled by upload middleware, but assuming string URL here
                // languages: Handle relation update if passed
            }
        });
        // Handle Languages (if they are passed as array of strings)
        if (languages && Array.isArray(languages)) {
            // 1. Get tutor ID
            const tutorId = updatedProfile.id;
            // 2. Delete existing
            await db_1.default.tutorLanguage.deleteMany({ where: { tutor_id: tutorId } });
            // 3. Create new
            if (languages.length > 0) {
                await db_1.default.tutorLanguage.createMany({
                    data: languages.map((lang) => ({
                        tutor_id: tutorId,
                        language: lang.language,
                        proficiency: lang.proficiency || 'Native'
                    }))
                });
            }
        }
        res.json(updatedProfile);
    }
    catch (error) {
        console.error('Update Bio Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateBio = updateBio;
// Update Education & Experience
const updateEducation = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { education, experience, certifications } = req.body;
        const profile = await db_1.default.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile)
            return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;
        // Transaction to update all lists
        await db_1.default.$transaction(async (tx) => {
            // Update Education
            if (education) {
                await tx.tutorEducation.deleteMany({ where: { tutor_id: tutorId } });
                if (education.length > 0) {
                    await tx.tutorEducation.createMany({
                        data: education.map((edu) => ({ ...edu, tutor_id: tutorId }))
                    });
                }
            }
            // Update Experience
            if (experience) {
                await tx.tutorExperience.deleteMany({ where: { tutor_id: tutorId } });
                if (experience.length > 0) {
                    await tx.tutorExperience.createMany({
                        data: experience.map((exp) => ({ ...exp, tutor_id: tutorId }))
                    });
                }
            }
            // Update Certifications
            if (certifications) {
                await tx.tutorCertification.deleteMany({ where: { tutor_id: tutorId } });
                if (certifications.length > 0) {
                    await tx.tutorCertification.createMany({
                        data: certifications.map((cert) => ({ ...cert, tutor_id: tutorId }))
                    });
                }
            }
        });
        res.json({ message: 'Professional details updated' });
    }
    catch (error) {
        console.error('Update Education Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateEducation = updateEducation;
// Update Services (Categories)
const updateServices = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { categoryIds } = req.body; // Array of leaf category IDs
        const profile = await db_1.default.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile)
            return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;
        if (categoryIds) {
            await db_1.default.tutorCategory.deleteMany({ where: { tutor_id: tutorId } });
            if (categoryIds.length > 0) {
                await db_1.default.tutorCategory.createMany({
                    data: categoryIds.map((catId) => ({
                        tutor_id: tutorId,
                        category_id: catId
                    }))
                });
            }
        }
        res.json({ message: 'Services updated' });
    }
    catch (error) {
        console.error('Update Services Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateServices = updateServices;
// Update Pricing
const updatePricing = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { hourly_rate } = req.body;
        const updatedProfile = await db_1.default.tutorProfile.update({
            where: { user_id: userId },
            data: { hourly_rate: parseInt(hourly_rate) }
        });
        res.json(updatedProfile);
    }
    catch (error) {
        console.error('Update Pricing Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updatePricing = updatePricing;
// Get All Categories (Tree)
const getCategories = async (req, res) => {
    try {
        // Fetch all categories
        const categories = await db_1.default.category.findMany({
            include: { children: { include: { children: true } } }
        });
        // Filter for root categories (parent_id is null)
        const rootCategories = categories.filter(c => c.parent_id === null);
        res.json(rootCategories);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getCategories = getCategories;
// Update External Reviews
const updateExternalReviews = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { external_reviews } = req.body;
        const profile = await db_1.default.tutorProfile.findUnique({ where: { user_id: userId } });
        if (!profile)
            return res.status(404).json({ error: 'Profile not found' });
        const tutorId = profile.id;
        if (external_reviews) {
            await db_1.default.tutorExternalReview.deleteMany({ where: { tutor_id: tutorId } });
            if (external_reviews.length > 0) {
                await db_1.default.tutorExternalReview.createMany({
                    data: external_reviews.map((rev) => ({ ...rev, tutor_id: tutorId }))
                });
            }
        }
        res.json({ message: 'External reviews updated' });
    }
    catch (error) {
        console.error('Update External Reviews Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.updateExternalReviews = updateExternalReviews;
