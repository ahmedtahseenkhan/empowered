import React from 'react';
import offers from './offeredData';
import { Crown } from '../../assets';

// Simplified Image component since we don't have Next.js Image
const Image = ({ src, alt, className, ...props }: any) => (
    <img src={src} alt={alt} className={className} {...props} />
);

const Offered = () => {
    return (
        <>
            <div className="max-w-7xl mx-auto px-5 py-10 md:px-0">
                <div className="flex justify-center text-center">
                    <h1 className="text-2xl md:text-4xl font-bold font-poppins text-gray-900">
                        Why Mentors Choose Empower<span style={{ color: "#4A148C" }}>Ed</span> Learnings
                    </h1>
                </div>
                <div className="flex justify-center mt-2">
                    <p className="text-center text-sm md:text-base font-poppins mx-auto max-w-2xl text-gray-600">
                        We do more than just give you a profile – we give you a business, a partner, and a mission: to empower mentors like you so that you can empower others.
                    </p>
                </div>

                <div className="flex justify-center flex-wrap gap-6 mt-[5%]">
                    {offers.map((offer, index) =>
                        index !== offers.length - 1 ? (
                            <div
                                key={index}
                                className="flex flex-col md:flex-row text-center md:text-left items-center md:items-start gap-4 font-poppins mt-[3%] w-[350px] p-4 bg-white rounded-xl hover:shadow-lg transition-shadow duration-300"
                            >
                                <div
                                    className={`${index < 3 ? "bg-[#4A148C]" : "bg-[#F4F4F5]"
                                        } p-2 rounded-full flex-shrink-0 w-[50px] h-[50px] flex items-center justify-center`}
                                >
                                    <img
                                        src={offer.img} // Note: .src might not be needed if imported as url
                                        alt={offer.title}
                                        className="w-[30px] h-[30px] object-contain"
                                    />
                                </div>
                                <div className="mt-2">
                                    <h1 className="font-bold text-[#4A148C] text-lg">{offer.title}</h1>
                                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{offer.description}</p>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={index}
                                className="flex flex-col md:flex-row text-center md:text-left items-center md:items-start gap-4 font-poppins mt-[3%] w-[350px] bg-[#4A148C] px-5 py-7 rounded-xl shadow-xl transform hover:scale-105 transition-transform duration-300"
                            >
                                <div
                                    className={
                                        "bg-[#F4F4F5] p-2 rounded-full flex-shrink-0 w-[50px] h-[50px] flex items-center justify-center"
                                    }
                                >
                                    <img
                                        src={offer.img}
                                        alt={offer.title}
                                        className="w-[30px] h-[30px] object-contain"
                                    />
                                </div>
                                <div className="mt-2 text-[#FFFFFF] relative">
                                    <h1 className="font-bold text-lg">{offer.title}</h1>
                                    <p className="mt-3 text-sm opacity-90 leading-relaxed">{offer.description}</p>
                                    <img
                                        src={Crown}
                                        alt="Crown Image"
                                        className="absolute -top-24 -right-2 md:-top-16 md:-right-4 w-20 md:w-24"
                                    />
                                </div>
                            </div>
                        )
                    )}
                </div>

                <div className="border-t-[1px] w-[90%] mx-auto mt-[8%] border-gray-200 "></div>
            </div>
        </>
    );
};
export default Offered;
