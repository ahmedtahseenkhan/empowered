import React, { useState } from 'react';
import { PageLayout } from '../layouts/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export const ContactUsPage: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement form submission
        console.log('Form submitted:', formData);
        alert('Thank you for your message! We\'ll get back to you soon.');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <PageLayout>
            <section className="section-container">
                <div className="text-center mb-16">
                    <h1 className="heading-xl mb-6">Contact Us</h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Have questions? We'd love to hear from you. Send us a message and we'll
                        respond as soon as possible.
                    </p>
                </div>

                <div className="max-w-3xl mx-auto">
                    <Card>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-900">Send us a Message</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input
                                label="Name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Your full name"
                            />

                            <Input
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="your.email@example.com"
                            />

                            <Input
                                label="Subject"
                                name="subject"
                                type="text"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                                placeholder="What is this regarding?"
                            />

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    rows={6}
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Tell us more about your inquiry..."
                                />
                            </div>

                            <Button type="submit" variant="primary" size="lg" className="w-full">
                                Send Message
                            </Button>
                        </form>
                    </Card>
                </div>
            </section>
        </PageLayout>
    );
};

export default ContactUsPage;
