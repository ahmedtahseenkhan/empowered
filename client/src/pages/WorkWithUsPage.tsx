import React from 'react';
import { PageLayout } from '../layouts/PageLayout';
import HeroSection from '../components/work-with-us/HeroSection';
import ChoosePlanDesktop from '../components/work-with-us/ChoosePlanDesktop';
import Offered from '../components/work-with-us/Offered';
import { useNavigate } from 'react-router-dom';

const WorkWithUsPage: React.FC = () => {
    const navigate = useNavigate();

    const handleChoosePlan = (planId: string) => {
        // Navigate to tutor registration with the selected plan
        navigate(`/tutor-register?planId=${planId}`);
    };

    return (
        <PageLayout>
            <div className="bg-white">
                <HeroSection />
                <ChoosePlanDesktop onChoosePlan={handleChoosePlan} />
                <Offered />
            </div>
        </PageLayout>
    );
};

export default WorkWithUsPage;
