import { Hero_image } from '../../assets'; // Using the standard export, assuming it's the right one
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';

const HeroSection = () => {
    return (
        <>
            {/* defining max width here */}
            <div className="max-w-7xl mx-auto mt-[5%] px-4">
                <div className="flex justify-center md:w-[90%] mx-auto lg:w-full mb-10 flex-wrap gap-8 items-center">
                    <div className="mt-0 md:mt-[50px] w-full md:w-[60%] lg:w-[45%] text-center md:text-left">
                        {/* Responsive heading */}
                        <h1 className="text-4xl md:text-5xl font-bold font-poppins tracking-wide leading-tight text-gray-900">
                            The Virtual Office for <span className="text-[#4A148C]">Independent Mentors</span>
                            <span className="block mt-3 text-2xl md:text-3xl text-gray-700">
                                Learn Anything, Succeed Everywhere!
                            </span>
                        </h1>

                        {/* Responsive paragraph */}
                        <p className="mt-6 text-gray-600 font-poppins hidden md:block text-lg leading-relaxed">
                            <span className="text-[#4A148C] font-semibold">EmpowerEd Learnings </span>{" "}
                            helps independent tutors, coaches, mentors, and skill instructors build,
                            manage, and grow their education business online with profiles, scheduling,
                            payments, student communication, discovery, and AI-assisted workflows in one place.
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-8">
                            {/* Responsive buttons */}
                            <Link to="/find-mentor">
                                <Button
                                    className="bg-[#4A148C] hover:bg-[#380e6e] px-8 py-4 rounded-full text-white text-sm md:text-lg shadow-lg"
                                >
                                    Find Your Perfect Mentor
                                </Button>
                            </Link>
                            <Link to="/work-with-us">
                                <Button
                                    className="bg-gradient-to-r from-accent-900 to-orange-500 hover:from-orange-600 hover:to-accent-900 px-8 py-4 rounded-full text-white text-sm md:text-lg shadow-lg"
                                >
                                    Join as a Mentor
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* div for the image */}
                    <div className="relative pt-5">
                        <img loading="eager" decoding="async" fetchPriority="high"
                            src={Hero_image}
                            alt="Hero Section"
                            className="object-cover rounded-3xl h-[280px] w-[280px] sm:h-[320px] sm:w-[320px] md:h-[360px] md:w-[360px] lg:h-[400px] lg:w-[400px] shadow-2xl"
                        />
                        <p className="text-center mt-4 font-poppins"></p>
                    </div>
                    <div>
                        <p className="mt-5 text-gray-600 p-5 text-center font-poppins block md:hidden text-lg leading-relaxed">
                            <span className="text-[#4A148C] font-semibold">EmpowerEd Learnings </span>
                            helps independent tutors, coaches, mentors, and skill instructors build,
                            manage, and grow their education business online — with profiles, scheduling,
                            payments, student communication, discovery, and AI-assisted workflows in one place.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default HeroSection;
