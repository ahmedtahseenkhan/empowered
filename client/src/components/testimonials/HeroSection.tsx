import React from 'react';
import { HeroSection_image, space_rocket, spiral_arrow } from '../../assets';

const HeroSection = () => {
    return (
        <>
            {/* defining max width here */}
            <div className="max-w-7xl mx-auto mt-[5%] px-4">
                <div className="flex justify-center mb-[10%] mt-[5%] md:w-[90%] mx-auto lg:w-full flex-wrap gap-8 lg:gap-[90px]">
                    <div className="w-[90%] mt-7 mx-auto md:mx-0 md:w-[60%] lg:w-[45%]">
                        {/* Responsive heading */}
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-poppins tracking-wide text-center md:text-left font-semibold text-gray-900 leading-tight">
                            Transformative Journeys with Empower
                            <span className="text-[#4A148C]">Ed</span> Learnings
                        </h1>

                        {/* Responsive paragraph */}
                        <p className="mt-5 font-poppins text-center md:text-left leading-relaxed text-gray-700 text-lg">
                            What Our Mentors and Students Say: Real Stories, Real Success!
                        </p>
                    </div>

                    {/* div for the image */}
                    <div className="relative">
                        <img
                            src={HeroSection_image}
                            alt="Hero Section Image"
                            className="object-cover rounded-2xl h-[250px] w-[350px] md:h-[300px] md:w-[400px] shadow-lg"
                        />
                        {/* Rocket ship image */}
                        <div className="absolute -top-[20px] sm:-top-[25px] md:-top-[30px] lg:-top-[37px] right-[10px] md:right-[15px] lg:right-[20px]">
                            <img
                                src={space_rocket}
                                alt="Rocket"
                                className="w-[35px] h-[35px] sm:w-[45px] sm:h-[45px] md:w-[55px] md:h-[55px] lg:w-[65px] lg:h-[65px]"
                            />
                        </div>
                        {/* Spiral Arrow on top of image */}
                        <div className="absolute top-4 -left-[15px] sm:-left-[20px] md:-left-[25px] lg:-left-[50px]">
                            <img
                                src={spiral_arrow}
                                alt="Spiral Arrow"
                                className="w-[50px] h-[30px] sm:w-[70px] sm:h-[50px] md:w-[90px] md:h-[70px] lg:w-[110px] lg:h-[90px]"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default HeroSection;
