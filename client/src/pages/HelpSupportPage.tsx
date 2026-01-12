import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Send } from 'lucide-react';

const HelpSupportPage: React.FC = () => {
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // TODO: Implement actual email sending logic
        setTimeout(() => {
            alert('Message sent successfully! We will get back to you soon.');
            setFormData({ subject: '', message: '' });
            setLoading(false);
        }, 1000);
    };

    return (
        <DashboardLayout>
            <div className="w-full">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-[#4A1D96] mb-4">Help and Support</h1>
                    <p className="text-gray-600 text-lg">
                        Have a question or need assistance? We're here to help!
                    </p>
                </div>

                {/* Contact Form */}
                <div className="bg-white rounded-3xl shadow-xl p-12">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Subject */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                Subject
                            </label>
                            <input
                                type="text"
                                name="subject"
                                placeholder="Subject"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                                className="w-full px-6 py-4 border-2 border-[#4A1D96] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A1D96] focus:border-transparent text-gray-700 placeholder-gray-400"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                Message
                            </label>
                            <textarea
                                name="message"
                                placeholder="Message"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                rows={8}
                                className="w-full px-6 py-4 border-2 border-[#4A1D96] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A1D96] focus:border-transparent text-gray-700 placeholder-gray-400 resize-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-center pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-[#4A1D96] hover:bg-[#3a1676] text-white rounded-full px-12 py-4 font-semibold text-lg flex items-center gap-3 shadow-lg hover:shadow-xl transition-all"
                            >
                                <Send size={20} />
                                {loading ? 'Sending...' : 'Send Message'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Additional Help Resources */}
                <div className="mt-12 grid md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl shadow-md p-6 text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📧</span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Email Us</h3>
                        <p className="text-sm text-gray-600">support@empoweredlearnings.com</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md p-6 text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📚</span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Documentation</h3>
                        <p className="text-sm text-gray-600">Browse our help articles</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md p-6 text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">💬</span>
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Live Chat</h3>
                        <p className="text-sm text-gray-600">Chat with our support team</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default HelpSupportPage;
