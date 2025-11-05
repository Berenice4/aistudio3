
import React from 'react';

const FocusViewIcon: React.FC = () => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="w-6 h-6 text-gray-400"
    >
        <path d="M3 3h6v6H3z" />
        <path d="M21 3h-6v6h6z" />
        <path d="M3 21h6v-6H3z" />
        <path d="M15 21h6v-6h-6z" />
    </svg>
);

export default FocusViewIcon;
