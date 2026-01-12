import React, { memo } from "react";
import {
    SvgStep1,
    SvgStep2,
    SvgStep3,
    HIW_svg_2,
    HIW_svg_3,
    HIW_svg_4,
    HIW_svg_5,
    HIW_svg_6,
    HIW_svg_7,
} from "../../assets";

// Helper to replace next/image
const Img = ({ src, alt, className, ...props }: any) => (
    <img src={src} alt={alt} className={className} {...props} />
);

const steps = [
    {
        stepNO: "Step 1: ",
        title: "Start Your Search",
        description:
            "Create Your Learner Profile by Sharing Your Details, Goals, and Preferences. Fill out your personal information, outline your learning objectives, and specify your areas of interest. A well-rounded and accurate profile enables us to provide customized recommendations and personalized support, ensuring that your learning experience is fully aligned with your individual needs and aspirations.",
        svg: SvgStep1,
    },
    {
        stepNO: "Step 2: ",
        title: "Choose Your Mentor",
        description:
            "Our platform uses advanced algorithms to match learners with the most suitable mentors based on their unique profiles and preferences. Browse through our extensive list of experts, read their bios, and check out their ratings and reviews. Once you've found the perfect match, you can connect with your mentor and start your learning journey right away.",
        svg: SvgStep2,
    },
    {
        stepNO: "Step 3: ",
        title: "Book & Begin",
        description:
            "Choose a time that fits your schedule, easily book your first session, and begin your personalized learning experience. With flexible options and seamless scheduling, you can start working with your mentor or coach right away. This is the first step toward achieving your goals and unlocking your full potential through EmpowerEd Learnings!.",
        svg: SvgStep3,
    },
];

const StepSVG = memo(({ src, alt }: { src: string; alt: string }) => (
    <div className="relative h-[60px] w-[60px] md:h-[70px] md:w-[70px]">
        <img src={src} alt={alt} className="w-full h-full object-contain" />
    </div>
));

StepSVG.displayName = "StepSVG";

const DecorativeSVG = memo(
    ({
        src,
        alt,
        className,
    }: {
        src: string;
        alt: string;
        className: string;
    }) => (
        <div className={className}>
            <img src={src} alt={alt} style={{ width: 114, height: 130 }} className="object-contain" />
        </div>
    )
);

DecorativeSVG.displayName = "DecorativeSVG";

const Step = memo(
    ({ step, index }: { step: (typeof steps)[0]; index: number }) => (
        <div className="flex flex-col md:flex-row md:gap-8 gap-4 mb-[50px] md:mb-[90px] items-center relative">
            {index % 2 === 0 && index !== steps.length - 1 && (
                <DecorativeSVG
                    src={HIW_svg_2}
                    alt="How it works"
                    className="absolute -right-1 -bottom-[46%] md:block hidden"
                />
            )}
            {index % 2 !== 0 && index !== steps.length - 1 && (
                <DecorativeSVG
                    src={HIW_svg_3}
                    alt="How it works"
                    className="absolute left-[7%] -bottom-[42%] md:block hidden"
                />
            )}
            {index === 0 && (
                <DecorativeSVG
                    src={HIW_svg_4}
                    alt="How it works"
                    className="absolute -left-[15%] -bottom-[10%] md:block hidden"
                />
            )}

            <div className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 mt-4 md:mt-[65px] border-[#F8BE30] border-[8px] md:border-[10px] bg-[#4A148C] rounded-full flex justify-center items-center">
                <StepSVG src={step.svg} alt="SVG Icon" />
            </div>

            <div className="text-center md:text-left">
                <h2 className="font-bold text-lg sm:text-xl md:text-2xl mt-2 mb-2 font-poppins">
                    <span className="text-[#4A148C]">{step.stepNO}</span> {step.title}
                </h2>

                <div className="w-[280px] sm:w-[350px] md:w-[450px] bg-[#F7F7F7] p-4 sm:p-5 rounded-xl shadow-[5px_5px_0px_#4A148C] font-poppins">
                    <p className="text-sm sm:text-base text-left text-gray-700">{step.description}</p>
                </div>
            </div>

            {index === 1 && (
                <div className="relative md:block hidden">
                    <div className="absolute -right-[30px] -top-[70px]">
                        <img src={HIW_svg_5} alt="" width={114} height={130} />
                    </div>
                    <div className="absolute -right-[70px]">
                        <img src={HIW_svg_6} alt="" width={114} height={130} />
                    </div>
                    <div className="absolute -right-[30px] top-[90px]">
                        <img src={HIW_svg_7} alt="" width={114} height={130} />
                    </div>
                </div>
            )}
        </div>
    )
);

Step.displayName = "Step";

export default function Steps() {
    return (
        <div className="max-w-7xl mx-auto mt-[7%] flex flex-col justify-center items-center px-4">
            {steps.map((step, index) => (
                <Step key={index} step={step} index={index} />
            ))}
        </div>
    );
}
