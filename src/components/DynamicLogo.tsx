import React, { useState, useEffect } from 'react';

// PLACEHOLDER: Replace this with your public GitHub raw repository path.
// Example: "https://raw.githubusercontent.com/username/repository-name/refs/heads/main" or "https://raw.githubusercontent.com/username/repository-name/main"
const GITHUB_RAW_BASE_URL: string = "YOUR_GITHUB_RAW_REPOSITORY_URL_HERE";

interface DynamicLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export function DynamicLogo({ fallbackSrc = "/logo.jpg", className, alt = "Logo", ...props }: DynamicLogoProps) {
  // Determine if we have a valid github URL config
  const hasGitHubUrl = GITHUB_RAW_BASE_URL && GITHUB_RAW_BASE_URL !== "YOUR_GITHUB_RAW_REPOSITORY_URL_HERE";
  
  const pngUrl = hasGitHubUrl ? `${GITHUB_RAW_BASE_URL.replace(/\/$/, '')}/logo.png` : fallbackSrc;
  const jpgUrl = hasGitHubUrl ? `${GITHUB_RAW_BASE_URL.replace(/\/$/, '')}/logo.jpg` : fallbackSrc;

  const [currentSrc, setCurrentSrc] = useState(pngUrl);
  const [hasFailedPng, setHasFailedPng] = useState(false);
  const [hasFailedJpg, setHasFailedJpg] = useState(false);

  // Sync state if GITHUB_RAW_BASE_URL / pngUrl changes
  useEffect(() => {
    setCurrentSrc(pngUrl);
    setHasFailedPng(false);
    setHasFailedJpg(false);
  }, [pngUrl]);

  const handleError = () => {
    if (!hasFailedPng) {
      setHasFailedPng(true);
      setCurrentSrc(jpgUrl);
    } else if (!hasFailedJpg) {
      setHasFailedJpg(true);
      setCurrentSrc(fallbackSrc);
    }
  };

  return (
    <img 
      src={currentSrc} 
      onError={handleError} 
      className={className} 
      alt={alt} 
      referrerPolicy="no-referrer"
      {...props} 
    />
  );
}
