import React from 'react';
import { Clock, Star } from '../../assets';

const SpecialOffer = () => {
    return (
        <div className="max-w-7xl mx-auto mt-[5%] mb-[5%]">
            <div className="w-[90%] mx-auto border-4 py-8 border-[#4A148C] rounded-2xl bg-[#F5F7FC] shadow-lg transform hover:scale-[1.01] transition-transform duration-300">
                <h1 className="text-center md:text-4xl text-2xl my-2 font-poppins font-semibold text-[#4A148C]">
                    Special Offer
                </h1>
                <div className="flex items-center px-5 md:px-0 gap-4 md:gap-8 justify-center my-6">
                    <div>
                        <img
                            src={Star}
                            alt="Special Offer Star"
                            className="w-[30px] h-[30px] md:w-[40px] md:h-[40px]"
                        />
                    </div>
                    <h3 className="text-center md:text-2xl text-lg font-poppins font-medium text-gray-800">
                        Don’t Miss Out on Our Early Bird Deal!
                    </h3>
                    <div>
                        <img
                            src={Clock}
                            alt="Special Offer Clock"
                            className="w-[30px] h-[30px] md:w-[40px] md:h-[40px]"
                        />
                    </div>
                </div>
                <p className="text-center mx-auto text-sm md:text-xl px-5 md:px-0 mb-2 font-poppins text-[#4A148C] font-semibold w-[90%] lg:w-[80%]">
                    Enjoy 2 Months FREE – Absolutely Risk-Free, with No Registration
                    Fees and No Subscription Costs. Limited Time Offer!
                </p>
            </div>
        </div>
    );
}
export default SpecialOffer;
