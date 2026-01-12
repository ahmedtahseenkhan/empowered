import { useCallback } from "react";
import { B_section1, B_section2 } from "../../assets";
import { useNavigate } from "react-router-dom";

const BottomSection = () => {
    const navigate = useNavigate();

    const handleFindMentorClick = useCallback(() => {
        // sessionStorage.setItem("redirectToMentorQuestionnaire", "true");
        navigate("/find-mentor");
    }, [navigate]);

    return (
        <div className="relative rounded-2xl overflow-hidden my-10 mx-4 bg-gradient-to-r from-[#4A148C] to-[#8228BB] shadow-xl">
            <div className="h-auto max-w-7xl flex flex-col justify-center w-[95%] md:w-[100%] items-center mx-auto py-10">
                {/* Text Section */}
                <div className="px-5 md:px-0 text-center leading-8 font-semibold font-poppins w-full md:w-[70%] z-10">
                    <h1 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight mb-8">
                        Discover Your Ideal Mentor for Unmatched Personal Growth and
                        Success!
                    </h1>
                </div>

                {/* Content Section */}
                <div className="flex flex-col-reverse md:flex-row justify-between items-center w-full px-8">
                    {/* Left SVG (shown on mobile) */}
                    <div className="mt-5 md:mt-0 flex-shrink-0 relative">
                        <img
                            src={B_section1}
                            alt="Bottom Section"
                            className="w-full md:w-[250px] lg:w-[300px] h-auto object-contain"
                        />
                    </div>

                    {/* Center Button */}
                    <div className="flex-grow text-center mt-8 md:mt-0 z-10">
                        <button
                            onClick={handleFindMentorClick}
                            className="bg-white text-[#4A148C] transform transition-all duration-300 px-8 py-4 font-poppins rounded-full hover:bg-gray-100 hover:scale-105 shadow-lg font-bold text-sm md:text-lg border-2 border-transparent hover:border-white"
                        >
                            Find Your Perfect Mentor
                        </button>
                    </div>

                    {/* Right SVG */}
                    <div className="hidden md:block flex-shrink-0">
                        <div className="mt-5 md:mt-0">
                            <img
                                src={B_section2}
                                alt="Bottom Section"
                                className="w-full md:w-[250px] lg:w-[300px] h-auto object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BottomSection;
