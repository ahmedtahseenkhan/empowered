import React, { useEffect, useState } from "react";
import {
    Bottom_card1,
    Bottom_card2,
    Bottom_card3,
    Bottom_card4,
} from "../../assets";

const WhyUs = () => {
    const cards = [
        {
            title: "Diverse Mentors",
            description:
                "We match you with experts who align with your specific needs and goals. Our diverse pool of mentors ensures that you receive the exact support you need",
            image: Bottom_card1,
        },
        {
            title: "Flexible Learning Options",
            description:
                "Enjoy personalized options including 1:1 live sessions, pre-recorded courses, test prep, and tutorials tailored to your pace and goals",
            image: Bottom_card2,
        },
        {
            title: "Quality Experience",
            description:
                "Access your mentor’s notes, learning materials, and timely updates through your personal dashboard for an organized and engaging experience",
            image: Bottom_card3,
        },
        {
            title: "Unlock your Full Potential",
            description:
                "We support not just your academic and career goals, but also your personal achievements, helping you unlock your full potential in all areas of life.",
            image: Bottom_card4,
        },
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    // Effect to auto-run the carousel
    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % cards.length);
        }, 3000); // Change slide every 3 seconds

        return () => clearInterval(intervalId); // Cleanup the interval on unmount
    }, [cards.length]);

    return (
        <div className="bg-[#F4F4F5] py-10 w-full">
            <div className="max-w-7xl mx-auto px-4">
                <div className="font-poppins">
                    <h1 className="text-center py-10 text-2xl md:text-4xl font-bold text-gray-900">
                        Why Choose Empower<span className="text-[#4A148C]">Ed</span>{" "}
                        Learnings?
                    </h1>

                    {/* Desktop Grid */}
                    <div className="hidden md:flex justify-center flex-wrap gap-8">
                        {cards.map((card, index) => (
                            <div
                                key={index}
                                className="bg-white w-[45%] lg:w-[40%] xl:w-[22%] my-5 rounded-3xl flex flex-col border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="p-6 text-center flex-grow">
                                    <h1 className="font-bold text-xl py-4 text-gray-900">{card.title}</h1>
                                    <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
                                </div>
                                <div className="relative h-[200px] w-full mt-auto">
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="object-cover w-full h-full"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Custom Carousel for smaller screens */}
                    <div className="md:hidden">
                        <div className="bg-white w-full mx-auto my-5 rounded-3xl flex flex-col border border-gray-200 shadow-lg overflow-hidden">
                            <div className="p-6 text-center flex-grow">
                                <h1 className="font-bold text-xl py-4 text-gray-900">
                                    {cards[currentIndex].title}
                                </h1>
                                <p className="text-sm text-gray-600 leading-relaxed">{cards[currentIndex].description}</p>
                            </div>
                            <div className="relative h-[200px] w-full">
                                <img
                                    src={cards[currentIndex].image}
                                    alt={cards[currentIndex].title}
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        </div>
                        {/* Dots indicator */}
                        <div className="flex justify-center gap-2 mt-4">
                            {cards.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full ${idx === currentIndex ? 'bg-[#4A148C]' : 'bg-gray-300'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhyUs;
