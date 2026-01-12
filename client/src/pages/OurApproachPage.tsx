import React from 'react';
import { PageLayout } from '../layouts/PageLayout';
import HeroSection from '../components/our-approach/HeroSection';
import ApproachSteps from '../components/our-approach/ApproachSteps';
import BottomSection from '../components/our-approach/BottomSection';

const OurApproachPage: React.FC = () => {
    return (
        <PageLayout>
            <div className="bg-white py-8">
                <HeroSection />
                <ApproachSteps />
                <BottomSection />
            </div>
        </PageLayout>
    );
};

export default OurApproachPage;
