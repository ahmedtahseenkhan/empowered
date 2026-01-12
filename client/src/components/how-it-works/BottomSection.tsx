import { useCallback } from 'react';
import { HIW_bottom_img1, HIW_bottom_img2 } from '../../assets';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

const BottomSection = () => {
    const navigate = useNavigate();

    const handleFindMentorClick = useCallback(() => {
        // sessionStorage.setItem('redirectToMentorQuestionnaire', 'true');
        navigate('/find-mentor');
    }, [navigate]);

    return (
        <div className="w-full bg-[#F9F9F9] border-[#DBDBDB] border-2 rounded-2xl my-10">
            {/* Inner Container */}
            <div className="h-auto max-w-7xl mx-auto flex flex-col justify-center w-[95%] md:w-[100%] items-center ">
                {/* Text Section */}
                <div className="pt-10 mb-8 sm:text-md md:text-2xl font-semibold w-full px-5 md:px-0 md:w-[60%] text-center font-poppins text-gray-900">
                    See the Impact for Yourself – Take Our Assessment and Start Your
                    Journey Today!
                </div>

                {/* Content Section */}
                <div className="flex flex-col-reverse md:flex-row justify-between items-center w-full px-4 md:px-10 pb-10">
                    {/* Left SVG (shown on mobile) */}
                    <div className="mt-5 md:mt-0">
                        <img
                            src={HIW_bottom_img1}
                            alt="How it works"
                            className="w-full md:w-[250px] lg:w-[300px] h-auto object-contain"
                        />
                    </div>

                    {/* Center Button */}
                    <div className="flex-grow text-center mt-5 md:mt-0">
                        <Button
                            variant="primary"
                            size="lg"
                            className="bg-[#4A148C] hover:bg-[#380e6e] text-white px-8 py-6 rounded-full text-sm md:text-lg"
                            onClick={handleFindMentorClick}
                        >
                            Find Your Perfect Mentor
                        </Button>
                    </div>

                    {/* Right SVG (hidden on mobile, shown on desktop) */}
                    <div className="hidden md:block">
                        <img
                            src={HIW_bottom_img2}
                            alt="How it works"
                            className="w-full md:w-[250px] lg:w-[300px] h-auto object-contain"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BottomSection;
