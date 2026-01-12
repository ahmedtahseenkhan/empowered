import React from 'react';
import {
    stars,
    tick,
    Crown,
    three_lines,
    comment_1,
    comment_2,
    comment_3,
    comment_5,
    comment_6,
    comment_7,
    comment_8,
    comment_9,
    comment_10,
    comment_11,
    comment_12,
    // comment_13
} from '../../assets';

const ReviewsSection = () => {

    const comments = [
        {
            imageSrc: comment_1,
            name: "Sophia M.",
            title: "",
            comment: "EmpowerEd Learnings completely changed how we approach learning at home. We found certified educators for academics and life skills all in one place. My son is more confident and consistent now. It's truly a one-stop shop for education and personal growth.",
            date: "",
        },
        {
            imageSrc: comment_2,
            name: "David R.",
            title: "",
            comment: "Before EmpowerEd, I struggled to keep my students on a routine. Now, sessions are automatically scheduled, payments are handled, and reminders keep me on track. I finally feel in control of their learning without doing all the admin work myself.",
            date: "",
        },
        {
            imageSrc: comment_3,
            name: "Hasnain S.",
            title: "",
            comment: "This platform made me feel like a true professional. My profile was verified within a day, and the video intro feature really helped students connect with me before booking. I got three recurring students in the first week!",
            date: "",
        },
        {
            imageSrc: comment_11,
            name: "Fatima N.",
            title: "",
            comment: "Safety and quality were my biggest concerns with online tutoring. Knowing that all mentors are verified gave me peace of mind. Plus, the free trial made it easy to test before committing. Highly recommended to any parent.",
            date: "",
        },
        {
            imageSrc: comment_6,
            name: "Michael S.",
            title: "",
            comment: "As someone who teaches on EmpowerEd, I love how simple it is to manage my calendar, earnings, and students. The platform takes care of the logistics so I can focus on teaching and helping learners succeed.",
            date: "",
        },
        {
            imageSrc: comment_7,
            name: "Olivia P.",
            title: "",
            comment: "I wanted more than tutoring. I wanted someone who could help my daughter build confidence and study habits. EmpowerEd gave us exactly that. The progress has been incredible in just a few months.",
            date: "",
        },
        {
            imageSrc: comment_8,
            name: "Maya K.",
            title: "",
            comment: "I booked a free trial in under three minutes and got matched with a perfect mentor for my daughter. The entire month was auto-scheduled, which saved me time. No back-and-forth texting or missed classes, everything is just there on the calendar.",
            date: "",
        },
        {
            imageSrc: comment_9,
            name: "Jafar M.",
            title: "",
            comment: "The ability to teach students globally has grown my business beyond what I thought possible. I went from two students to ten in a month – all through EmpowerEd Learnings.",
            date: "",
        },
        {
            imageSrc: comment_10,
            name: "Ethan Z.",
            title: "",
            comment: "The platform is simple enough that even my 12-year-old can book extra sessions himself. It gives him ownership of his learning journey. I appreciate the progress updates mentors send through the platform. I feel like I'm part of my son's learning process.",
            date: "",
        },
        {
            imageSrc: comment_5,
            name: "Samir H.",
            title: "",
            comment: "EmpowerEd Learnings completely transformed my tutoring business. Keeping 100% of my earnings with no commissions is a game changer. I can track student progress, send session notes, and manage everything from one dashboard.",
            date: "",
        },
        {
            imageSrc: comment_12,
            name: "Syeda F.",
            title: "",
            comment: "The EmpowerEd team takes care of scheduling, payments, and marketing for me, so I can focus entirely on coaching. Their support has helped me grow my client base faster and freed up my time to do what I do best - empower my clients!",
            date: "",
        },
    ];

    return (
        <>
            <div className="max-w-7xl mx-auto mb-10 px-4">
                <div className="flex flex-col my-[5%] px-5 md:px-0 items-center font-poppins relative">
                    <h1 className="text-4xl font-bold text-center relative text-gray-900">
                        What Our Users Say
                        <img
                            src={three_lines}
                            alt="lines"
                            className="absolute -right-9 hidden md:block -top-0 w-[40px] h-[40px]"
                        />
                        <img
                            src={Crown}
                            alt="Crown"
                            className="absolute -top-10 left-1/2 transform -translate-x-1/2 hidden md:block w-15 h-auto w-[40px]"
                        />
                    </h1>
                </div>

                <div className="flex justify-center items-start flex-wrap gap-6">
                    {comments.map((comment, index) => (
                        <div
                            key={index}
                            className="bg-[#F9F9F9] hover:bg-[#4A148C] group hover:text-white cursor-pointer hover:scale-105 transform transition duration-200 w-full sm:w-[90%] md:w-[45%] lg:w-[30%] h-auto font-poppins rounded-3xl border-[1px] border-[#D9D9D9] shadow-xl p-5"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={comment.imageSrc}
                                        alt="User"
                                        className="h-[40px] w-[40px] rounded-full object-cover"
                                    />
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-bold text-xl">{comment.name}</h1>
                                        <img
                                            src={tick}
                                            alt="Verified"
                                            className="w-6 h-6 object-contain"
                                        />
                                    </div>
                                </div>
                                <div className="mt-1">
                                    <img
                                        src={stars}
                                        alt="Rating"
                                        className="w-20 h-auto"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h1 className="font-semibold">{comment.title}</h1>
                                <p className="text-sm leading-relaxed opacity-90">{comment.comment}</p>
                            </div>
                            {comment.date && (
                                <div className="pt-4 text-sm">
                                    <p className="text-[#7A7A7A] group-hover:text-gray-300">{comment.date}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
export default ReviewsSection;
