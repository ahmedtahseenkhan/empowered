import { Link } from 'react-router-dom';
import { Hero_section, Green_Arrow } from '../../assets';
import { Button } from '../ui/Button';

const PURPLE = "#4A148C";
const ORANGE = "#DD5D00";
const GREEN = "#25A36F";
const GRAY = "#7A7A7A";

export default function HeroSection() {
    return (
        <section className="max-w-7xl mx-auto px-5 py-8 md:px-0">
            <h1 className="text-center text-4xl font-bold font-poppins text-gray-900">
                Become a Mentor with Empower<span style={{ color: PURPLE }}>Ed</span>{" "}
                Learnings
            </h1>
            <p className="text-center mt-2 text-lg" style={{ color: GRAY }}>
                Teach. Coach. Inspire. Grow your business—on your terms.
            </p>

            <div className="flex flex-wrap justify-evenly my-[5%] items-start">
                <div className="relative w-full md:w-[539px] h-auto">
                    <img
                        src={Hero_section}
                        alt="EmpowerEd Learnings Team"
                        className="object-cover w-full h-auto"
                    />
                </div>
                <div
                    className="font-poppins text-center md:text-left text-2xl md:text-4xl max-w-[590px] font-medium mt-8 md:mt-[7%] relative"
                    style={{ color: ORANGE }}
                >
                    <h2>
                        Are you a passionate educator, coach or instructor eager to run your
                        own business with ease and independence
                        <span style={{ color: GREEN }}>?</span>
                    </h2>
                    <div className="hidden xl:block absolute right-4 bottom-[-20px] translate-y-full">
                        {/* Adjusted positioning slightly as next/image behaves differently */}
                        <img
                            src={Green_Arrow}
                            alt="Green Arrow"
                            className="object-contain w-[120px] h-[150px]"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center max-w-4xl mx-auto">
                <p className="text-center text-xl mb-6 text-gray-800 leading-relaxed">
                    At <span style={{ color: PURPLE, fontWeight: 'bold' }}>EmpowerEd Learnings</span>, we
                    connect passionate tutors, coaches, and instructors with students
                    worldwide. We give you the tools, marketing, and freedom to run your
                    business your way—and keep 100% of your earnings.
                </p>
                <p
                    className="text-xl text-center hidden lg:block font-medium"
                    style={{ color: PURPLE }}
                >
                    Take advantage of our special offer and see how we can help you grow
                    your student base and maximize your earnings.
                </p>
                <div className="mt-8">
                    <Button
                        as={Link}
                        to="/find-mentor"
                        variant="primary"
                        size="lg"
                        className="px-12 py-4 text-lg rounded-full"
                    >
                        Book a Demo
                    </Button>
                </div>
            </div>
        </section>
    );
}
