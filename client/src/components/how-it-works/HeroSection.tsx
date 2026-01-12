import { Hero_svg } from "../../assets";
import { Button } from "../ui/Button";
import { Link } from "react-router-dom";

const HeroSection = () => {
    return (
        <>
            <div className="max-w-7xl font-poppins mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 mt-10">
                    <div className="text-3xl md:text-5xl mt-10 text-center px-5 font-bold text-gray-900 leading-tight">
                        {" "}
                        Begin Your Success Journey with <br />
                        <span className="text-[#4A148C]">Three Easy Steps!</span>
                    </div>
                    <div className="relative bottom-5 md:block hidden">
                        <img
                            src={Hero_svg}
                            alt="Hero Section"
                            width={100}
                            height={100}
                            className="w-[100px] h-[100px] object-contain"
                        />
                    </div>
                </div>

                <div className="flex-grow md:hidden text-center mt-8 md:mt-0">
                    <Link to="/find-mentor">
                        <Button
                            className="bg-[#4A148C] px-6 py-3 sm:px-7 sm:py-3 rounded-full text-white text-xs sm:text-sm md:text-md"
                        >
                            Find Your Perfect Mentor
                        </Button>
                    </Link>
                </div>
            </div>
        </>
    );
};

export default HeroSection;
