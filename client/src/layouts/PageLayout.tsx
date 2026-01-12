import React from 'react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

interface PageLayoutProps {
    children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow">
                {children}
            </main>
            <Footer />
        </div>
    );
};
