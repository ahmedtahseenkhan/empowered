import React from 'react';
import { PageLayout } from '../layouts/PageLayout';
import HeroSection from '../components/testimonials/HeroSection';
import ReviewsSection from '../components/testimonials/ReviewsSection';
import BottomSection from '../components/testimonials/BottomSection';

const TestimonialsPage: React.FC = () => {
    return (
        <PageLayout>
            <div className="bg-white py-8">
                <HeroSection />
                <ReviewsSection />
                <div className="max-w-7xl mx-auto">
                    <BottomSection />
                </div>
            </div>
        </PageLayout>
    );
};

export default TestimonialsPage;
