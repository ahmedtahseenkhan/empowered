import React from 'react';

interface HoneypotFieldProps {
    value: string;
    onChange: (value: string) => void;
}

/** Hidden `company_website` field: people never see or fill it, so a value means a bot. */
const HoneypotField: React.FC<HoneypotFieldProps> = ({ value, onChange }) => (
    <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
    >
        <label htmlFor="company_website">Company website</label>
        <input
            id="company_website"
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

export default HoneypotField;
