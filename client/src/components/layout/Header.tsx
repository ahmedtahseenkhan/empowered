import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import logo from '../../assets/logo.svg';
import { AnnouncementBar } from './AnnouncementBar';
import { useAuth } from '../../context/AuthContext';

const navLinks = [
    { name: 'How it Works', path: '/how-it-works' },
    { name: 'Our Approach', path: '/our-approach' },
    { name: 'Find a Mentor', path: '/find-mentor' },
    { name: 'Work with Us', path: '/work-with-us' },
];

const moreLinks = [
    { name: 'Testimonials', path: '/testimonials' },
    { name: 'FAQs', path: '/faqs' },
    { name: 'Contact Us', path: '/contact-us' },
];

export const Header: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
        setIsMoreOpen(false);
    }, [location.pathname]);

    const isActive = (path: string) => location.pathname === path;
    const isMoreActive = moreLinks.some((l) => isActive(l.path));

    return (
        <>
            <AnnouncementBar />
            <header
                className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
                    scrolled ? 'shadow-md' : 'shadow-sm'
                }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">

                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
                            <img src={logo} alt="EmpowerEd Learnings" className="h-12 w-auto" />
                            <span className="text-lg font-bold text-gray-900 leading-tight">
                                Empower<span className="text-accent-900">Ed</span>{' '}
                                <span className="block text-xs font-medium text-gray-500 tracking-wide">
                                    Learnings
                                </span>
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                                        isActive(link.path)
                                            ? 'text-primary-900 bg-primary-50'
                                            : 'text-gray-600 hover:text-primary-900 hover:bg-gray-50'
                                    }`}
                                >
                                    {link.name}
                                    {isActive(link.path) && (
                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary-900" />
                                    )}
                                </Link>
                            ))}

                            {/* "More" dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                                    onBlur={() => setTimeout(() => setIsMoreOpen(false), 150)}
                                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                                        isMoreActive
                                            ? 'text-primary-900 bg-primary-50'
                                            : 'text-gray-600 hover:text-primary-900 hover:bg-gray-50'
                                    }`}
                                >
                                    More
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                            isMoreOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                {isMoreOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                                        {moreLinks.map((link) => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                className={`block px-4 py-2 text-sm font-medium transition-colors ${
                                                    isActive(link.path)
                                                        ? 'text-primary-900 bg-primary-50'
                                                        : 'text-gray-600 hover:text-primary-900 hover:bg-gray-50'
                                                }`}
                                            >
                                                {link.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </nav>

                        {/* Desktop Right CTAs */}
                        <div className="hidden lg:flex items-center gap-3">
                            {/* Beta badge link */}
                            <Link
                                to="/beta"
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                                    bg-gradient-to-r from-accent-900 to-orange-500 text-white
                                    hover:from-orange-600 hover:to-accent-900 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                                <Sparkles className="w-3 h-3" />
                                Join Beta
                            </Link>

                            <Link
                                to="/book-demo"
                                className="px-4 py-2 text-sm font-medium text-primary-900 border border-primary-200
                                    rounded-lg hover:bg-primary-50 transition-colors duration-150"
                            >
                                Book a Demo
                            </Link>

                            {user ? (
                                <Button as={Link} to="/dashboard" variant="primary" size="md">
                                    Dashboard
                                </Button>
                            ) : (
                                <Button as={Link} to="/select-user-type" variant="primary" size="md">
                                    Log in
                                </Button>
                            )}
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="Toggle menu"
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? (
                                <X className="w-5 h-5" />
                            ) : (
                                <Menu className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Drawer */}
                <div
                    className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
                        isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                    <div className="border-t border-gray-100 bg-white px-4 py-4 space-y-1">
                        {[...navLinks, ...moreLinks].map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive(link.path)
                                        ? 'text-primary-900 bg-primary-50'
                                        : 'text-gray-700 hover:text-primary-900 hover:bg-gray-50'
                                }`}
                            >
                                {link.name}
                            </Link>
                        ))}

                        <div className="pt-3 border-t border-gray-100 space-y-2">
                            <Link
                                to="/beta"
                                className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-lg text-sm font-semibold
                                    bg-gradient-to-r from-accent-900 to-orange-500 text-white"
                            >
                                <Sparkles className="w-4 h-4" />
                                Join Beta — Limited Spots
                            </Link>
                            <Link
                                to="/book-demo"
                                className="block text-center w-full px-4 py-2.5 text-sm font-medium text-primary-900
                                    border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                            >
                                Book a Demo
                            </Link>
                            {user ? (
                                <Link to="/dashboard" className="block">
                                    <Button variant="primary" size="md" className="w-full">
                                        Go to Dashboard
                                    </Button>
                                </Link>
                            ) : (
                                <Link to="/select-user-type" className="block">
                                    <Button variant="primary" size="md" className="w-full">
                                        Log in
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};
