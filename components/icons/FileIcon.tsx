
import React from 'react';

interface FileIconProps {
    className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20" 
        fill="currentColor" 
        className={className || "w-5 h-5"}
    >
        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.343a1 1 0 00-.293-.707l-4.636-4.636A1 1 0 0012.657 2H4zm6 6a1 1 0 01-1-1V3l5 5h-4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

export default FileIcon;
