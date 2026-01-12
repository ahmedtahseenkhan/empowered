import React from 'react';
import { PageLayout } from '../layouts/PageLayout';
import HeroSection from '../components/home/HeroSection';
import EasySteps from '../components/home/EasySteps';
import WhyUs from '../components/home/WhyUs';
import CommentsSection from '../components/home/CommentsSection';

const HomePage: React.FC = () => {
    return (
        <PageLayout>
            <div className="bg-white">
                <HeroSection />
                <WhyUs />
                <EasySteps />
                <CommentsSection />
            </div>
        </PageLayout>
    );
};

export default HomePage;
