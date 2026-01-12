import React, { useState } from "react";
import { singleQuote_1, Acc_arrow } from "../../assets";

// Props definition based on usage in CommentsSection
// testimonial object structure: { imgSrc, name, title, testimonial, by, color }
interface TestimonialCardProps {
    imgSrc?: string | null;
    name: string;
    title: string;
    testimonial: string;
    by: string;
    color: string;
}

const CardComponent: React.FC<TestimonialCardProps> = ({
    imgSrc,
    name,
    title,
    testimonial,
    by,
    color,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleAccordion = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div
            className={`rounded-3xl p-6 m-4 w-full md:w-[600px] lg:w-[800px] shadow-lg transition-all duration-300 relative`}
            style={{ backgroundColor: color }}
        >
            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Quote Icon */}
                <div className="absolute top-6 left-6 opacity-20">
                    <img src={singleQuote_1} alt="Quote" className="w-10 h-10" />
                </div>

                {/* Image/Avatar */}
                <div className="z-10 mt-2 ml-2 md:mt-0 md:ml-0 flex-shrink-0">
                    {imgSrc ? (
                        <img
                            src={imgSrc}
                            alt={name}
                            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-white shadow-md"
                        />
                    ) : (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/50 flex items-center justify-center text-2xl font-bold text-gray-500 border-2 border-white shadow-md">
                            {name.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-grow z-10">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 font-poppins">{name}</h3>
                    <p className="text-sm md:text-base font-semibold text-gray-700 mb-4">{title}</p>

                    <div className="bg-white/40 rounded-xl p-4 backdrop-blur-sm">
                        <p className={`text-gray-800 leading-relaxed font-poppins text-sm md:text-base ${isOpen ? '' : 'line-clamp-3 md:line-clamp-4'}`}>
                            "{testimonial}"
                        </p>

                        {/* Read More button if text is long */}
                        {testimonial.length > 150 && (
                            <button
                                onClick={toggleAccordion}
                                className="mt-2 flex items-center gap-1 text-sm font-semibold text-[#4A148C] hover:underline"
                            >
                                {isOpen ? 'Read Less' : 'Read More'}
                                <img
                                    src={Acc_arrow}
                                    alt="Toggle"
                                    className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CardComponent;
