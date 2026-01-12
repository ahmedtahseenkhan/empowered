import { useCallback } from "react";
import { cup_person } from "../../assets";
import { Button } from "../ui/Button";
import { useNavigate } from "react-router-dom";

const BottomSection = () => {
    const navigate = useNavigate();

    const handleFindMentorClick = useCallback(() => {
        navigate("/find-mentor");
    }, [navigate]);

    return (
        <>
            <div className="max-w-7xl mx-auto mt-24 mb-12 px-4">
                <div className="pt-16 bg-[#F9F9F9] pb-[70px] md:pb-[120px] mt-10 relative rounded-3xl border border-gray-100">
                    <div className="flex flex-col justify-center items-center">
                        <div className="w-[80%] md:w-[50%] mr-0 md:mr-[100px] lg:mr-[200px] mx-auto z-10">
                            <p className="text-center text-[#8228BB] font-poppins text-xl md:text-2xl font-medium leading-relaxed">
                                EmpowerEd Learnings provides personalized guidance at every step
                                — because success isn’t one-size-fits-all.
                            </p>
                        </div>

                        <img
                            src={cup_person}
                            alt="Person Holding Cup Image"
                            className="absolute h-[120px] w-[120px] right-4 top-4 sm:right-10 sm:top-10 md:h-[200px] md:w-[200px] lg:h-[300px] lg:w-[300px] md:right-10 md:top-[-50px] opacity-90"
                        />

                        <div className="mt-12 z-20">
                            <Button
                                variant="primary"
                                size="lg"
                                className="bg-[#4A148C] hover:bg-[#380e6e] px-8 py-6 rounded-full text-white text-md sm:text-lg"
                                onClick={handleFindMentorClick}
                            >
                                Find Your Perfect Mentor
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default BottomSection;
