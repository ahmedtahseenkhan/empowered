import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa';

const socialLinks = [
    {
        name: 'Facebook',
        href: 'https://www.facebook.com/share/1BaqhHXBtK/?mibextid=wwXIfr',
        icon: FaFacebookF,
    },
    {
        name: 'Instagram',
        href: 'https://www.instagram.com/emplearnings?igsh=M25lYmgzNHNhYzlj&utm_source=qr',
        icon: FaInstagram,
    },
    {
        name: 'LinkedIn',
        href: 'https://www.linkedin.com/company/emplearnings/',
        icon: FaLinkedinIn,
    },
];

export const Footer: React.FC = () => {
    return (
        <footer className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Company Info */}
                    <div className="col-span-1 md:col-span-2">
                        <h3 className="text-[18px] md:text-[20px] font-bold mb-4 text-empowered-dark">
                            Empower<span className="text-empowered-orange">Ed</span> Learnings
                        </h3>
                        <p className="text-[14px] text-empowered-gray mb-4">
                            Learn Anything, Succeed Everywhere! Connect with experts in academic tutoring,
                            skill development, and life or career coaching.
                        </p>
                        <div className="flex items-center space-x-3">
                            {socialLinks.map(({ name, href, icon: Icon }) => (
                                <a
                                    key={name}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={name}
                                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-empowered-gray hover:bg-empowered-orange hover:text-white hover:border-empowered-orange transition-colors"
                                >
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-[16px] font-semibold text-empowered-dark mb-4">Quick Links</h4>
                        <ul className="space-y-2">
                            <li>
                                <Link to="/our-approach" className="text-gray-600 hover:text-primary-900 transition-colors">
                                    Our Story
                                </Link>
                            </li>
                            <li>
                                <Link to="/contact-us" className="text-gray-600 hover:text-primary-900 transition-colors">
                                    Contact Us
                                </Link>
                            </li>
                            <li>
                                <Link to="/faqs" className="text-gray-600 hover:text-primary-900 transition-colors">
                                    FAQs
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* For Mentors */}
                    <div>
                        <h4 className="text-[16px] font-semibold text-empowered-dark mb-4">For Mentors</h4>
                        <ul className="space-y-2">
                            <li>
                                <Link to="/work-with-us" className="text-gray-600 hover:text-primary-900 transition-colors">
                                    Become a Mentor
                                </Link>
                            </li>
                            <li>
                                <Link to="/mentor-agreement" className="text-gray-600 hover:text-primary-900 transition-colors">
                                    Terms and Conditions
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <p className="text-gray-600 text-sm">
                            © {new Date().getFullYear()} EmpowerEd Learnings. All rights reserved.
                        </p>
                        <div className="flex space-x-6">
                            <Link to="/terms-of-service" className="text-gray-600 hover:text-primary-900 text-sm transition-colors">
                                Terms of Service
                            </Link>
                            <Link to="/privacy-policy" className="text-gray-600 hover:text-primary-900 text-sm transition-colors">
                                Privacy Policy
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
