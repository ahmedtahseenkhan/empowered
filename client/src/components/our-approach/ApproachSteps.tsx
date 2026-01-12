import React, { useMemo } from 'react';
import {
    encircled_person,
    person_group,
    still_life,
    approach_step2,
    approach_step3,
} from '../../assets';

const ApproachSteps = () => {
    const approachStepsData = useMemo(
        () => [
            {
                title: "Why We’re Different",
                titleImg: person_group,
                describe:
                    "Success isn’t one-dimensional, and neither is our support. Our approach is built on the belief that growth is multifaceted, and we are here to support every aspect of it. We’re more than just a tutoring service. We recognize that true success goes beyond academics; it requires a mix of knowledge, soft skills, and hard skills. From cultivating a growth mindset to taking the right steps toward achieving your goals, we’re here to support you at every stage of your journey.",
                img: still_life,
                priority: true,
            },
            {
                title: "Holistic Development",
                titleImg: encircled_person,
                describe:
                    "As former educators and counselors, we know that academic achievement is only part of the journey. That’s why we’ve integrated life coaching and skill development into our services, focusing on unlocking your true potential. Whether you need help with academics, career guidance, building soft skills like time management or goal-setting, or mastering hard skills such as coding, public speaking, or music, we provide the right experts and qualified mentors for your complete personal and professional development.",
                img: approach_step2,
                priority: false,
            },
            {
                title: "Personalized Mentorship",
                titleImg: "", // Empty string logic handled in loop
                describe:
                    "At EmpowerEd Learnings, we connect you with the perfect mentor tailored to your needs and goals. Our mission is to streamline the process and ensure a seamless experience for you. Whether you're seeking tutoring, coaching, or skill-building, our qualified experts are dedicated to guiding and empowering you every step of the way. Let us help you find the right mentor to unlock your full potential with a comprehensive, personalized approach to growth and success!",
                img: approach_step3,
                priority: false,
            },
        ],
        []
    );

    const Step = ({ step, index }: any) => {
        const rowClass = index % 2 === 0 ? "" : "flex-row-reverse";
        const borderClass =
            index % 2 === 1 ? "border-[#4A148C]" : "border-[#ffffff]";
        const backgroundClass = index % 2 === 1 ? "bg-[#ffffff]" : "bg-[#4A148C]";
        const textColor = index % 2 === 1 ? "text-black" : "text-white";

        return (
            <div className="mt-[8%]">
                <div
                    className={`flex flex-wrap items-center justify-center gap-2 ${rowClass}`}
                >
                    <div>
                        <h1 className="font-poppins underline decoration-[#4A148C] text-2xl font-semibold text-center text-gray-900">
                            {step.title}
                        </h1>
                    </div>
                    {step.titleImg && (
                        <div>
                            <img src={step.titleImg} alt="" height={50} width={50} className="w-[50px] h-[50px]" />
                        </div>
                    )}
                </div>

                <div
                    className={`flex flex-wrap items-start justify-around w-[90%] mx-auto mt-10 mb-10 gap-8 lg:gap-0 ${rowClass}`}
                >
                    <div className="w-full md:w-[40%] md:h-[600px] flex justify-center items-center relative">
                        <img
                            src={step.img}
                            className="object-cover rounded-3xl w-full h-auto md:h-full box-shadow-xl"
                            alt="Description of the image"
                        />
                    </div>

                    <div
                        className={`border-[1px] md:w-[45%] mt-0 md:mt-[80px] p-10 rounded-3xl shadow-lg ${borderClass} ${backgroundClass} ${textColor}`}
                    >
                        <p className="font-poppins leading-relaxed text-lg">{step.describe}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4">
            {approachStepsData.map((step, index) => (
                <Step key={index} step={step} index={index} />
            ))}
        </div>
    );
};

export default ApproachSteps;
