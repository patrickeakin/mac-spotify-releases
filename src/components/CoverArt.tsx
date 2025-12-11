import React, { useState, useEffect } from 'react';

type ImageLoadState = 'loading' | 'loaded' | 'error' | 'no-image';

interface CoverArtProps {
  imageUrl: string;
  altText: string;
  className?: string;
}

export const CoverArt: React.FC<CoverArtProps> = ({ imageUrl, altText, className = '' }) => {
  const [loadState, setLoadState] = useState<ImageLoadState>('loading');
  const [displayUrl, setDisplayUrl] = useState<string>('');

  useEffect(() => {
    // Reset state when imageUrl changes
    if (!imageUrl || imageUrl.trim() === '') {
      setLoadState('no-image');
      setDisplayUrl('');
      return;
    }

    setLoadState('loading');
    setDisplayUrl('');

    // Create a new Image object to test loading
    const img = new Image();
    
    const handleLoad = () => {
      setLoadState('loaded');
      setDisplayUrl(imageUrl);
    };

    const handleError = () => {
      console.log(`Failed to load cover art: ${imageUrl}`);
      setLoadState('error');
      setDisplayUrl('');
    };

    img.onload = handleLoad;
    img.onerror = handleError;
    
    // Start loading the image
    img.src = imageUrl;

    // Cleanup function
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  const getBackgroundStyle = () => {
    if (loadState === 'loaded' && displayUrl) {
      return {
        backgroundImage: `url(${displayUrl})`,
        backgroundColor: 'transparent'
      };
    }
    return {
      backgroundImage: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.1)'
    };
  };

  const shouldShowFallback = loadState === 'error' || loadState === 'no-image';
  const shouldShowLoading = loadState === 'loading';

  return (
    <div 
      className={`album-artwork ${className}`}
      style={getBackgroundStyle()}
    >
      {shouldShowLoading && (
        <div className="cover-art-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {shouldShowFallback && (
        <div className="cover-art-fallback">
          <div className="no-cover-text">
            No Cover
          </div>
        </div>
      )}
      
      {/* Invisible img element for accessibility and testing */}
      {loadState === 'loaded' && (
        <img 
          src={displayUrl} 
          alt={altText}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};