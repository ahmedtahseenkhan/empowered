import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import logo from '../../assets/logo.svg';
import { AnnouncementBar } from './AnnouncementBar';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    const navLinks = [
        { name: 'How it Works', path: '/how-it-works' },
        { name: 'Our Approach', path: '/our-approach' },
        { name: 'Testimonials', path: '/testimonials' },
        { name: 'Work with Us', path: '/work-with-us' },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="sticky top-0 z-50 bg-white shadow-sm backdrop-blur-sm bg-opacity-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-28">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3">
                        <img src={logo} alt="EmpowerEd Learnings" className="h-24 w-auto" />
                        <span className="text-xl font-bold text-gray-900">Empowered Learnings</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`font-medium transition-colors pb-1 border-b-2 ${isActive(link.path)
                                    ? 'text-primary-900 border-primary-900'
                                    : 'text-gray-700 hover:text-primary-900 border-transparent'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <Button
                                as={Link}
                                to="/dashboard"
                                variant="primary"
                                size="md"
                            >
                                Go to Dashboard
                            </Button>
                        ) : (
                            <Button
                                as={Link}
                                to="/select-user-type"
                                variant="primary"
                                size="md"
                            >
                                Log in
                            </Button>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? (
                            <X className="w-6 h-6 text-gray-700" />
                        ) : (
                            <Menu className="w-6 h-6 text-gray-700" />
                        )}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-100">
                        <nav className="flex flex-col space-y-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`font-medium transition-colors ${isActive(link.path)
                                        ? 'text-primary-900'
                                        : 'text-gray-700 hover:text-primary-900'
                                        }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            {user ? (
                                <Link
                                    to="/dashboard"
                                    className="inline-block"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <Button variant="primary" size="md" className="w-full">
                                        Go to Dashboard
                                    </Button>
                                </Link>
                            ) : (
                                <Link
                                    to="/select-user-type"
                                    className="inline-block"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <Button variant="primary" size="md" className="w-full">
                                        Log in
                                    </Button>
                                </Link>
                            )}
                        </nav>
                    </div>
                )}
            </div>
            <AnnouncementBar />
        </header>
    );
};
