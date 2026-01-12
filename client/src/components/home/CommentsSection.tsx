import React, { useRef, useState, useEffect, useMemo } from "react";
import {
    comments_bg,
    comments_svg1,
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
    comment_13,
    trusted_families,
} from "../../assets";
import CardComponent from "./CardComponent";

const CommentsSection = () => {
    const phrases = useMemo(
        () => ["Peace of Mind", "Success Story", "Growth Journey", "Perfect Match"],
        []
    );

    const testimonials = useMemo(
        () => [
            {
                imgSrc: comment_1,
                name: "Sophia M.",
                title: "A One-Stop Solution",
                testimonial:
                    "EmpowerEd Learnings completely changed how we approach learning at home. We found certified educators for academics and life skills all in one place. My son is more confident and consistent now. It's truly a one-stop shop for education and personal growth.",
                by: "Sophia M.",
                color: "#FAD4B9",
            },
            {
                imgSrc: comment_2,
                name: "David R.",
                title: "Total Control, Zero Stress",
                testimonial:
                    "Before EmpowerEd, I struggled to keep my students on a routine. Now, sessions are automatically scheduled, payments are handled, and reminders keep me on track. I finally feel in control of their learning without doing all the admin work myself.",
                by: "David R.",
                color: "#F2F9EE",
            },
            {
                imgSrc: comment_3,
                name: "Hasnain S.",
                title: "Professional Platform Experience",
                testimonial:
                    "This platform made me feel like a true professional. My profile was verified within a day, and the video intro feature really helped students connect with me before booking. I got three recurring students in the first week!",
                by: "Hasnain S.",
                color: "#FFF3FF",
            },
            {
                imgSrc: comment_11,
                name: "Fatima N.",
                title: "Peace of Mind for Parents",
                testimonial:
                    "Safety and quality were my biggest concerns with online tutoring. Knowing that all mentors are verified gave me peace of mind. Plus, the free trial made it easy to test before committing. Highly recommended to any parent.",
                by: "Fatima N.",
                color: "#FAD4B9",
            },
            // Added more to ensure scroll loop works smoothly
            {
                imgSrc: comment_7,
                name: "Olivia P.",
                title: "Building Confidence",
                testimonial:
                    "I wanted more than tutoring. I wanted someone who could help my daughter build confidence and study habits. EmpowerEd gave us exactly that. The progress has been incredible in just a few months.",
                by: "Olivia P.",
                color: "#F2F9EE",
            },
        ],
        []
    );

    const scrollRef = useRef<HTMLDivElement>(null);
    const [displayText, setDisplayText] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [loopIndex, setLoopIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Typewriter effect
    useEffect(() => {
        const currentPhrase = phrases[loopIndex % phrases.length];
        const type = () => {
            setDisplayText((prev) => currentPhrase.substring(0, prev.length + 1));
            if (displayText === currentPhrase) { // Fixed comparison logic
                setTimeout(() => setIsDeleting(true), 1000); // Pause before deleting
            }
        };

        const erase = () => {
            setDisplayText((prev) => prev.substring(0, prev.length - 1));
            if (displayText === "") {
                setIsDeleting(false);
                setLoopIndex((prev) => prev + 1);
            }
        };

        const timer = setTimeout(
            () => {
                // Correctly handle the updating logic to avoid stuck state
                if (!isDeleting && displayText === currentPhrase) {
                    setIsDeleting(true);
                } else if (isDeleting && displayText === "") {
                    setIsDeleting(false);
                    setLoopIndex(prev => prev + 1);
                } else {
                    if (isDeleting) setDisplayText(prev => prev.slice(0, -1));
                    else setDisplayText(prev => currentPhrase.slice(0, prev.length + 1));
                }
            },
            isDeleting ? 100 : 150
        );

        return () => clearTimeout(timer);
    }, [displayText, isDeleting, loopIndex, phrases]);

    // Infinite Scroll effect
    useEffect(() => {
        const scroll = () => {
            if (!isPaused) {
                const container = scrollRef.current;
                if (container) {
                    container.scrollLeft += 1; // Slower scroll

                    if (
                        container.scrollLeft >=
                        (container.scrollWidth / 2) // Reset when half-way (since we duplicate items)
                    ) {
                        container.scrollLeft = 0;
                    }
                }
            }
        };

        const interval = setInterval(scroll, 20);
        return () => clearInterval(interval);
    }, [isPaused]);

    return (
        <>
            <div className="max-w-7xl mx-auto font-poppins overflow-hidden px-4">
                <div className="flex items-center justify-center mb-[6%] mt-[8%] gap-5 md:w-[60%] lg:w-[50%] mx-auto">
                    <div>
                        <h1 className="text-3xl md:text-5xl text-center font-bold text-gray-900">
                            Your <span className="text-[#4A148C]">{displayText}</span>
                            <span className="animate-pulse">|</span>
                        </h1>
                    </div>
                    <div className="relative bottom-5 md:block hidden">
                        <img
                            src={comments_svg1}
                            alt="Comments Icon"
                            className="w-[90px] h-[90px] object-contain"
                        />
                    </div>
                </div>
            </div>

            <div
                className="bg-cover bg-center py-16"
                style={{
                    backgroundImage: `url(${comments_bg})`,
                }}
            >
                <div className="max-w-full mx-auto">
                    <div className="font-poppins flex flex-col items-center mb-10">
                        <h1 className="text-[#4A148C] text-center px-5 text-3xl md:text-4xl font-bold mb-4">
                            What People Are Saying About Our Platform
                        </h1>
                        <p className="text-center px-5 text-gray-600 max-w-2xl text-lg">
                            Hear from learners who have experienced exceptional growth and
                            support from our expert mentors.
                        </p>
                    </div>

                    {/* Horizontal Scroll Container */}
                    <div
                        className="flex overflow-x-hidden pb-5 relative no-scrollbar"
                        style={{ width: "100%" }}
                        ref={scrollRef}
                    >
                        <div className="flex gap-6 px-4">
                            {/* Original Set */}
                            {testimonials.map((testimonial, index) => (
                                <div
                                    key={`original-${index}`}
                                    className="inline-block flex-shrink-0"
                                    onMouseEnter={() => setIsPaused(true)}
                                    onMouseLeave={() => setIsPaused(false)}
                                >
                                    <CardComponent {...testimonial} />
                                </div>
                            ))}
                            {/* Duplicate Set for Infinite Loop */}
                            {testimonials.map((testimonial, index) => (
                                <div
                                    key={`duplicate-${index}`}
                                    className="inline-block flex-shrink-0"
                                    onMouseEnter={() => setIsPaused(true)}
                                    onMouseLeave={() => setIsPaused(false)}
                                >
                                    <CardComponent {...testimonial} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {/* Trust Indicator - Optional */}
            {/* <div className="mt-8 flex justify-center gap-2 items-center font-poppins text-gray-600">
        <img
          src={trusted_families}
          alt="Trusted Families"
          className="w-6 h-6 inline"
        />
        <p className="text-center inline text-sm">
          Trusted by <span className="font-semibold text-gray-900">100+</span> Families
        </p>
      </div> */}
        </>
    );
};

export default CommentsSection;
