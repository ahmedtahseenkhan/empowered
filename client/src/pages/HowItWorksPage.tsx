import React from 'react';
import { PageLayout } from '../layouts/PageLayout';
import HeroSection from '../components/how-it-works/HeroSection';
import Steps from '../components/how-it-works/Steps';
import BottomSection from '../components/how-it-works/BottomSection';

const HowItWorksPage: React.FC = () => {
    return (
        <PageLayout>
            <div className="bg-white py-12">
                <HeroSection />
                <Steps />
                <div className="max-w-7xl mx-auto px-4 mt-20">
                    <BottomSection />
                </div>
            </div>
        </PageLayout>
    );
};

export default HowItWorksPage;
