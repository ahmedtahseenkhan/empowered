import { useNavigate } from "react-router-dom";
import { arrow } from "../../assets";
import { Button } from "../ui/Button";

const EasySteps = () => {
    const navigate = useNavigate();

    const handleFindMentorClick = () => {
        navigate("/find-mentor");
    };

    const steps = [
        {
            step: 1,
            title: "Start Your Search",
            description:
                "Create your personalized profile to tell us about your goals and needs.",
        },
        {
            step: 2,
            title: "Choose Your Mentor",
            description:
                "Browse expert mentors and match with the one perfectly aligned with your needs.",
        },
        {
            step: 3,
            title: "Book & Begin",
            description:
                "Schedule your session and start your journey to success!",
        },
    ];

    // Logic to handle rotation based on screen size could be added, 
    // but CSS transform is handled in the render.

    return (
        <div className="max-w-7xl mx-auto py-16 px-4">
            <section className="bg-[#F8BE30] rounded-[50px] py-16 px-5 relative overflow-hidden shadow-xl">
                {/* Heading */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-5xl font-bold font-poppins text-black drop-shadow-sm">
                        Begin Your Success Journey<br />
                        with <span className="text-white">Three Easy Steps!</span>
                    </h1>
                </div>

                {/* Steps Container */}
                <div className="flex flex-col md:flex-row justify-center items-center gap-8 lg:gap-12 relative z-10">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-col md:flex-row items-center gap-4">
                            <div className="bg-white rounded-[30px] p-8 w-[280px] sm:w-[320px] h-[280px] flex flex-col justify-center items-center text-center shadow-lg transition-transform hover:scale-105 duration-300">
                                <div className="bg-[#4A148C] text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-md">
                                    {step.step}
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-gray-900 font-poppins">{step.title}</h3>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>

                            {/* Arrow (except after last item) */}
                            {index < steps.length - 1 && (
                                <div className="hidden md:block">
                                    <img
                                        src={arrow}
                                        alt="Next"
                                        className="w-16 h-auto opacity-80"
                                    />
                                </div>
                            )}
                            {index < steps.length - 1 && (
                                <div className="block md:hidden my-2">
                                    <img
                                        src={arrow}
                                        alt="Next"
                                        className="w-10 h-auto transform rotate-90 opacity-80"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Button Section */}
                <div className="mt-16 flex justify-center">
                    <Button
                        className="bg-[#4A148C] hover:bg-[#380e6e] px-10 py-4 rounded-full text-white text-lg font-bold shadow-lg transition-transform hover:scale-110"
                        onClick={handleFindMentorClick}
                    >
                        Find Your Perfect Mentor
                    </Button>
                </div>
            </section>
        </div>
    );
};

export default EasySteps;
