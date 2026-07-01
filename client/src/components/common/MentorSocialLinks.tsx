import React from 'react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Globe, Music2 } from 'lucide-react';

export interface MentorSocials {
    facebook_url?: string | null;
    instagram_url?: string | null;
    linkedin_url?: string | null;
    twitter_url?: string | null;
    youtube_url?: string | null;
    tiktok_url?: string | null;
    website_url?: string | null;
}

const LINKS: { key: keyof MentorSocials; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'website_url', label: 'Website', Icon: Globe },
    { key: 'linkedin_url', label: 'LinkedIn', Icon: Linkedin },
    { key: 'instagram_url', label: 'Instagram', Icon: Instagram },
    { key: 'facebook_url', label: 'Facebook', Icon: Facebook },
    { key: 'twitter_url', label: 'X (Twitter)', Icon: Twitter },
    { key: 'youtube_url', label: 'YouTube', Icon: Youtube },
    { key: 'tiktok_url', label: 'TikTok', Icon: Music2 },
];

// Ensure the href has a protocol so it isn't treated as a relative path.
const normalizeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

interface Props {
    mentor: MentorSocials;
    className?: string;
}

export const MentorSocialLinks: React.FC<Props> = ({ mentor, className }) => {
    const present = LINKS.filter((l) => {
        const v = mentor[l.key];
        return typeof v === 'string' && v.trim().length > 0;
    });

    if (present.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
            {present.map(({ key, label, Icon }) => (
                <a
                    key={key}
                    href={normalizeHref((mentor[key] as string).trim())}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="w-9 h-9 rounded-full border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
                >
                    <Icon className="w-4 h-4" />
                </a>
            ))}
        </div>
    );
};

export default MentorSocialLinks;
