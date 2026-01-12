import React from 'react';
import { our_approach_heroSection, overlay } from '../../assets';

const HeroSection = () => {
    return (
        <>
            {/* Set max-width container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-around mt-10 gap-5 items-center">
                    <div className="font-poppins text-center md:text-left">
                        {/* Responsive heading */}
                        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
                            Empower
                            <span className="text-[#4A148C]">Ed</span> Learnings
                        </h1>

                        {/* Responsive paragraph */}
                        <p className="mt-5 text-lg md:text-xl text-[#7A7A7A] leading-7 w-full sm:w-[340px] mx-auto md:mx-0">
                            Where Growth Meets Potential, and Success Knows No Limits.
                        </p>
                    </div>

                    {/* Responsive image container */}
                    <div className="w-full sm:w-[60%] md:w-[40%] h-[250px] sm:h-[300px] relative mt-5 md:mt-0">
                        <img
                            src={our_approach_heroSection}
                            className="object-cover rounded-3xl border-[1px] border-[#4A148C] w-full h-full"
                            alt="Hero Section Image"
                        />

                        {/* Overlay image with responsive positioning */}
                        <div className="absolute h-[150px] md:h-[200px] w-[300px] z-10 top-[50px] md:top-[120px] sm:top-[200px] left-[50%] md:left-[20px] transform -translate-x-1/2 md:translate-x-0 -translate-y-1/2 pointer-events-none">
                            {/* Adjusted positioning slightly for img tag vs next/image layout */}
                            <img
                                src={overlay}
                                className="object-cover w-full h-full"
                                alt="Hero Section Overlay"
                                style={{ objectPosition: "0% 100%" }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default HeroSection;
