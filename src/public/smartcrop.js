/**
 * Smart Crop Integration for The Arcane Observer
 * @author SanoKei
 */

// Initialize smart crop system
function initSmartCrop() {
    console.log('Initializing SmartCrop...');
    
    // Load SmartCrop.js first, then apply
    loadSmartCropScript()
        .then(() => {
            // Allow some time for images to load
            setTimeout(() => {
                applySmartCrop();
                setupResizeHandler();
                addSmartCropToggle();
            }, 500);
        })
        .catch(error => {
            console.error('Failed to load SmartCrop:', error);
            // Apply fallback positioning
            applyFallbackPositioning();
        });
}

// Add SmartCrop.js to the page
function loadSmartCropScript() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.smartcrop) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/smartcrop/2.0.3/smartcrop.min.js';
        script.onload = () => {
            console.log('SmartCrop script loaded successfully');
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load SmartCrop script');
            reject(new Error('Failed to load SmartCrop script'));
        };
        document.head.appendChild(script);
    });
}

// Main function to apply smart cropping
async function applySmartCrop() {
    if (!window.smartcrop) {
        console.warn('SmartCrop not available, using fallback positioning');
        applyFallbackPositioning();
        return;
    }
    
    console.log('Applying smart crop to images...');
    
    try {
        // Process main image first
        await processMainImage();
        
        // Then process other article images
        processArticleImages();
        
    } catch (error) {
        console.error('SmartCrop processing error:', error);
        applyFallbackPositioning();
    }
}

// Process the main feature image
async function processMainImage() {
    const mainImageContainer = document.querySelector('.main-image');
    if (!mainImageContainer) return;
    
    const mainImg = mainImageContainer.querySelector('img');
    if (!mainImg || !mainImg.src) return;
    
    console.log('Processing main image:', mainImg.src);
    
    try {
        // Handle external images through proxy if needed
        if (!isLocalImage(mainImg.src) && !mainImg.src.includes('/proxy-image')) {
            const originalSrc = mainImg.src;
            mainImg.setAttribute('data-original-src', originalSrc);
            mainImg.src = convertToProxiedUrl(originalSrc);
            addProxyIndicator(mainImageContainer);
            
            // Wait a bit for the image to load through proxy
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Wait for image to be fully loaded
        if (!mainImg.complete) {
            await new Promise(resolve => {
                mainImg.onload = resolve;
                mainImg.onerror = () => {
                    console.warn('Main image loading failed');
                    resolve();
                };
            });
        }
        
        // Ensure image has loaded and has dimensions
        if (mainImg.naturalWidth === 0 || mainImg.naturalHeight === 0) {
            throw new Error('Image failed to load with valid dimensions');
        }
        
        // Get container dimensions for target size
        const containerWidth = mainImageContainer.offsetWidth;
        const containerHeight = mainImageContainer.offsetHeight;
        
        // Run SmartCrop analysis
        const result = await window.smartcrop.crop(mainImg, { 
            width: containerWidth, 
            height: containerHeight,
            minScale: 0.8,
            // Boost face detection importance
            boost: [
                {
                    x: 0, y: 0,
                    width: 1, height: 1,
                    weight: 1.0
                }
            ]
        });
        
        const crop = result.topCrop;
        
        // Apply the crop by adjusting object-position
        const percentLeft = (crop.x / mainImg.naturalWidth) * 100;
        const percentTop = (crop.y / mainImg.naturalHeight) * 100;
        
        // Set styles correctly while preserving other styles
        mainImg.style.objectFit = 'cover';
        mainImg.style.objectPosition = `${percentLeft}% ${percentTop}%`;
        
        // Show focus indicator effect
        addFocusIndicator(mainImageContainer, percentLeft, percentTop);
        
        console.log('SmartCrop applied to main image successfully');
    } catch (error) {
        console.warn('SmartCrop failed for main image, using fallback:', error);
        applyBasicPositioning(mainImg);
    }
}

// Process all article images
function processArticleImages() {
    const articleImages = document.querySelectorAll('.article-img-container img');
    
    articleImages.forEach(async (img, index) => {
        // Skip if it's inside a main-image container (already processed)
        if (img.closest('.main-image')) return;
        
        // Process with small delay between images to avoid overwhelming browser
        setTimeout(async () => {
            try {
                // Handle external images
                if (!isLocalImage(img.src) && !img.src.includes('/proxy-image')) {
                    const originalSrc = img.src;
                    img.setAttribute('data-original-src', originalSrc);
                    img.src = convertToProxiedUrl(originalSrc);
                    
                    const container = img.closest('.article-img-container');
                    if (container) {
                        addProxyIndicator(container);
                    }
                    
                    // Wait for the proxy image to load
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Wait for image to be fully loaded
                if (!img.complete) {
                    await new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = () => {
                            console.warn(`Article image ${index} loading failed`);
                            resolve();
                        };
                    });
                }
                
                // Proceed with smart cropping
                applySmartCropToArticleImage(img);
                
            } catch (error) {
                console.warn(`Error processing article image ${index}:`, error);
                applyBasicPositioning(img);
            }
        }, index * 150); // Staggered processing
    });
}

// Apply SmartCrop to article images
async function applySmartCropToArticleImage(img) {
    if (!window.smartcrop || !img) return;
    
    const container = img.closest('.article-img-container');
    if (!container) return;
    
    try {
        // Ensure image has loaded with valid dimensions
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            throw new Error('Image has invalid dimensions');
        }
        
        // Get container dimensions
        const containerWidth = container.offsetWidth;
        const containerHeight = img.offsetHeight || 200; // Default height if not set
        
        // Run SmartCrop analysis
        const result = await window.smartcrop.crop(img, { 
            width: containerWidth, 
            height: containerHeight,
            minScale: 0.9
        });
        
        const crop = result.topCrop;
        
        // Apply the crop
        const percentLeft = (crop.x / img.naturalWidth) * 100;
        const percentTop = (crop.y / img.naturalHeight) * 100;
        
        // Set the object position for proper cropping
        img.style.objectFit = 'cover';
        img.style.objectPosition = `${percentLeft}% ${percentTop}%`;
        
    } catch (error) {
        console.warn('SmartCrop failed for article image, using fallback:', error);
        applyBasicPositioning(img);
    }
}

// Apply fallback positioning to all images
function applyFallbackPositioning() {
    // Main image
    const mainImg = document.querySelector('.main-image img');
    if (mainImg) {
        applyBasicPositioning(mainImg);
    }
    
    // Article images
    const articleImages = document.querySelectorAll('.article-img-container img');
    articleImages.forEach(img => {
        if (!img.closest('.main-image')) { // Skip if already handled above
            applyBasicPositioning(img);
        }
    });
}

// Add a subtle visual indicator for the focus area
function addFocusIndicator(container, percentLeft, percentTop) {
    // Remove any existing indicator
    const existingIndicator = container.querySelector('.focus-indicator');
    if (existingIndicator) {
        container.removeChild(existingIndicator);
    }
    
    // Create focus indicator element
    const indicator = document.createElement('div');
    indicator.className = 'focus-indicator';
    indicator.style.position = 'absolute';
    indicator.style.width = '50px';
    indicator.style.height = '50px';
    indicator.style.borderRadius = '50%';
    indicator.style.border = '2px solid rgba(255, 220, 115, 0.6)';
    indicator.style.boxShadow = '0 0 10px rgba(216, 173, 255, 0.4)';
    indicator.style.pointerEvents = 'none';
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 1s ease';
    indicator.style.zIndex = '10';
    
    // Position the indicator at the focus point
    indicator.style.left = `calc(${percentLeft}% - 25px)`;
    indicator.style.top = `calc(${percentTop}% - 25px)`;
    
    // Add to container and fade in briefly
    container.style.position = 'relative';
    container.appendChild(indicator);
    
    // Fade in
    setTimeout(() => {
        indicator.style.opacity = '0.8';
        
        // Add magical effect
        createFocusSparkles(container, percentLeft, percentTop);
        
        // Fade out after showing briefly
        setTimeout(() => {
            indicator.style.opacity = '0';
            
            // Remove after animation
            setTimeout(() => {
                if (container.contains(indicator)) {
                    container.removeChild(indicator);
                }
            }, 1000);
        }, 1500);
    }, 300);
}

// Add a small indicator for proxied images
function addProxyIndicator(container) {
    // Only add if we don't already have one
    if (container.querySelector('.proxy-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'proxy-indicator';
    indicator.title = 'Image enhanced via proxy';
    indicator.style.position = 'absolute';
    indicator.style.bottom = '5px';
    indicator.style.right = '5px';
    indicator.style.backgroundColor = 'rgba(216, 173, 255, 0.7)';
    indicator.style.color = '#321e46';
    indicator.style.fontSize = '10px';
    indicator.style.padding = '2px 5px';
    indicator.style.borderRadius = '3px';
    indicator.style.zIndex = '5';
    indicator.style.opacity = '0.7';
    indicator.style.pointerEvents = 'none';
    indicator.textContent = '✨';
    
    container.style.position = 'relative';
    container.appendChild(indicator);
    
    // Fade out after a few seconds
    setTimeout(() => {
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 1s ease';
        
        // Remove after fade out
        setTimeout(() => {
            if (container.contains(indicator)) {
                container.removeChild(indicator);
            }
        }, 1000);
    }, 3000);
}

// Create sparkle effect around the focus point
function createFocusSparkles(container, percentLeft, percentTop) {
    const rect = container.getBoundingClientRect();
    const x = rect.left + (percentLeft / 100) * rect.width;
    const y = rect.top + (percentTop / 100) * rect.height;
    
    // Add sparkles around the focus point
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 20;
            const sparkleX = x + Math.cos(angle) * distance;
            const sparkleY = y + Math.sin(angle) * distance;
            
            // Use the existing createSparkleAtPosition function
            if (typeof createSparkleAtPosition === 'function') {
                createSparkleAtPosition(sparkleX, sparkleY);
            }
        }, i * 100);
    }
}

// Apply basic image positioning fallback
function applyBasicPositioning(img) {
    if (!img) return;
    
    // Simple heuristic that assumes important content is in the center
    // or slightly above center for most images
    img.style.objectFit = 'cover';
    img.style.objectPosition = '50% 40%';
    
    // Add a minimal transition for smooth adjustments
    img.style.transition = 'object-position 0.5s ease';
}

// Add resize handler to reapply smart crop when window size changes
function setupResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            applySmartCrop();
        }, 500);
    });
}

// Check if an image is likely local or external
function isLocalImage(src) {
    if (!src) return true;
    
    // If it's a relative path or from the same domain
    const currentDomain = window.location.hostname;
    try {
        const imageUrl = new URL(src, window.location.href);
        return imageUrl.hostname === currentDomain || 
               imageUrl.hostname === 'localhost' || 
               imageUrl.hostname === '127.0.0.1' ||
               src.startsWith('/') || 
               src.startsWith('./') || 
               src.startsWith('../');
    } catch (e) {
        // If we can't parse the URL, assume it's local
        return true;
    }
}

// Convert external image URLs to use the proxy
function convertToProxiedUrl(originalUrl) {
    // Skip conversion for data URLs, local images, or already proxied images
    if (!originalUrl || 
        originalUrl.startsWith('data:') || 
        isLocalImage(originalUrl) || 
        originalUrl.includes('/proxy-image')) {
        return originalUrl;
    }
    
    // Use the Flask proxy endpoint
    return `/proxy-image?url=${encodeURIComponent(originalUrl)}`;
}

// Add a toggle button to manually trigger smart crop
function addSmartCropToggle() {
    // Remove existing toggle if present
    const existingToggle = document.querySelector('#smart-crop-toggle');
    if (existingToggle) {
        existingToggle.remove();
    }
    
    // Create a small floating button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'smart-crop-toggle';
    toggleBtn.textContent = '✂️';
    toggleBtn.title = 'Re-apply Smart Crop';
    toggleBtn.className = 'smart-crop-toggle';
    toggleBtn.style.position = 'fixed';
    toggleBtn.style.bottom = '20px';
    toggleBtn.style.right = '20px';
    toggleBtn.style.zIndex = '1000';
    toggleBtn.style.background = 'rgba(216, 173, 255, 0.7)';
    toggleBtn.style.border = '2px solid var(--wizard-dark)';
    toggleBtn.style.borderRadius = '50%';
    toggleBtn.style.width = '40px';
    toggleBtn.style.height = '40px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toggleBtn.style.fontSize = '20px';
    toggleBtn.style.display = 'flex';
    toggleBtn.style.alignItems = 'center';
    toggleBtn.style.justifyContent = 'center';
    
    // Add hover effect
    toggleBtn.style.transition = 'all 0.3s ease';
    toggleBtn.addEventListener('mouseover', () => {
        toggleBtn.style.transform = 'scale(1.1)';
        toggleBtn.style.boxShadow = '0 2px 10px rgba(216, 173, 255, 0.7)';
    });
    
    toggleBtn.addEventListener('mouseout', () => {
        toggleBtn.style.transform = 'scale(1)';
        toggleBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    });
    
    // Add click handler
    toggleBtn.addEventListener('click', () => {
        toggleBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            toggleBtn.style.transform = 'scale(1)';
            applySmartCrop();
        }, 200);
    });
    
    // Add to the document
    document.body.appendChild(toggleBtn);
}

// Export the init function to be called from main script
window.initSmartCrop = initSmartCrop;