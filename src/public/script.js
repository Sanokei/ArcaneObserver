/**
 * Integration with existing script.js
 * @author SanoKei
 */

// Add this line to your document ready function in your existing script.js
document.addEventListener('DOMContentLoaded', function() {
    updatePublicationDate();
    convertDigitByDigit();
    document.getElementById('current-year').textContent = new Date().getFullYear();
    initSparkleEffects();
    animateHeadings();
    addImageHoverEffects();
    makeWaxSealInteractive();
    setInterval(addRandomSparkle, 300);
    fixMainImageCropping(); // Added this function call
    
    // Add this line to initialize smart crop
    if (typeof initSmartCrop === 'function') {
        initSmartCrop();
    } else {
        // Load and initialize smart crop feature
        loadSmartCropFeature();
    }
});

/**
 * Converts each digit of a number to its Roman numeral representation
 * @param {number} num - The number to convert
 * @returns {string} Each digit converted to Roman numerals
 */
function convertDigitByDigit(num) {
    // Convert the number to a string to access individual digits
    const numString = num.toString();
    
    // Map of digits (0-9) to Roman numerals
    const digitToRoman = {
        '0': 'N', // N for "nulla" (though zero wasn't part of classical Roman numerals)
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
        '7': 'VII',
        '8': 'VIII',
        '9': 'IX'
    };
    
    // Convert each digit and join them
    let result = '';
    for (let i = 0; i < numString.length; i++) {
        result += digitToRoman[numString[i]];
    }
    
    return result;
}

/**
 * Fix main image cropping to fit into its frame correctly
 */
function fixMainImageCropping() {
    const mainImageContainers = document.querySelectorAll('.main-image');
    
    mainImageContainers.forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;
        
        // Set the image to fill the container completely
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        // Reset any transform applied to the img
        img.style.transform = 'none';
        
        // Ensure image has proper object position
        if (!img.style.objectPosition) {
            img.style.objectPosition = 'center';
        }
        
        // Remove any background image from the container
        // as we want the img element to handle the image display
        container.style.backgroundImage = 'none';
    });
}

// Function to load the smart crop script dynamically
function loadSmartCropFeature() {
    const script = document.createElement('script');
    script.src = '../public/smartcrop.js'; // Adjust path as needed
    script.onload = function() {
        console.log('SmartCrop feature loaded');
        if (typeof initSmartCrop === 'function') {
            initSmartCrop();
        } else {
            console.warn('initSmartCrop function not found');
        }
    };
    script.onerror = function() {
        console.error('Failed to load SmartCrop feature');
    };
    document.head.appendChild(script);
}

/**
 * Updates the publication date with a magical format
 */
function updatePublicationDate() {
    const currentDate = new Date();
    const dateElement = document.getElementById('publication-date');
    
    // Get moon phase (simplified)
    const moonPhases = [
        "New Moon", "Waxing Crescent", "First Quarter", 
        "Waxing Gibbous", "Full Moon", "Waning Gibbous", 
        "Last Quarter", "Waning Crescent"
    ];
    const moonPhase = moonPhases[Math.floor((currentDate.getDate() / 30) * 8) % 8];
    
    // Format the date in a mystical way
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    
    const day = currentDate.getDate();
    const month = months[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    
    // Add magical suffix to day number
    let daySuffix = "th";
    if (day === 1 || day === 21 || day === 31) daySuffix = "st";
    if (day === 2 || day === 22) daySuffix = "nd";
    if (day === 3 || day === 23) daySuffix = "rd";
    
    // Set the magical date format
    dateElement.textContent = `${month} ${day}${daySuffix}, ${year} • ${moonPhase}`;
}

/**
 * Initializes magical sparkle effects
 */
function initSparkleEffects() {
    // Set up sparkle container
    const sparkleContainer = document.getElementById('sparkle-container');
    
    // Add event listener for mousemove to create sparkles
    document.addEventListener('mousemove', function(e) {
        // Only create sparkles occasionally to avoid overwhelming effects
        if (Math.random() > 0.9) {
            createSparkleAtPosition(e.clientX, e.clientY);
        }
    });
    
    // Make magical advertisements sparkle
    const adverts = document.querySelectorAll('.magical-advert');
    adverts.forEach(advert => {
        const advertSparkles = advert.querySelector('.advert-sparkles');
        
        // Create initial sparkles
        for (let i = 0; i < 5; i++) {
            createSparkleInElement(advertSparkles);
        }
        
        // Continue adding sparkles
        setInterval(() => {
            createSparkleInElement(advertSparkles);
        }, 1000);
    });
}

/**
 * Creates a sparkle element at the specified position
 */
function createSparkleAtPosition(x, y) {
    const sparkle = document.createElement('div');
    sparkle.classList.add('sparkle');
    
    // Random size for the sparkle
    const size = 3 + Math.random() * 6;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    
    // Position the sparkle
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    
    // Random color variations
    const hue = Math.floor(Math.random() * 60) + 30; // Gold variations
    sparkle.style.backgroundColor = `hsl(${hue}, 100%, 70%)`;
    sparkle.style.boxShadow = `0 0 ${Math.floor(size * 1.5)}px ${Math.floor(size / 2)}px hsla(${hue}, 100%, 70%, 0.8)`;
    
    // Random animation duration
    const duration = 1 + Math.random() * 3;
    sparkle.style.animationDuration = `${duration}s`;
    
    // Add the sparkle to the container
    document.getElementById('sparkle-container').appendChild(sparkle);
    
    // Remove the sparkle after it fades out
    setTimeout(() => {
        sparkle.remove();
    }, duration * 1000);
}

/**
 * Creates a sparkle within a specific element
 */
function createSparkleInElement(element) {
    if (!element) return;
    
    const sparkle = document.createElement('div');
    sparkle.classList.add('sparkle');
    
    // Random size
    const size = 2 + Math.random() * 4;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    
    // Random position within the element
    const rect = element.getBoundingClientRect();
    const x = Math.random() * rect.width;
    const y = Math.random() * rect.height;
    
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    
    // Random gold/purple color variations
    let hue;
    if (Math.random() > 0.5) {
        hue = Math.floor(Math.random() * 60) + 30; // Gold variations
    } else {
        hue = Math.floor(Math.random() * 40) + 260; // Purple variations
    }
    
    sparkle.style.backgroundColor = `hsl(${hue}, 100%, 70%)`;
    sparkle.style.boxShadow = `0 0 ${Math.floor(size * 1.5)}px ${Math.floor(size / 2)}px hsla(${hue}, 100%, 70%, 0.8)`;
    
    // Random animation duration
    const duration = 1 + Math.random() * 2;
    sparkle.style.animationDuration = `${duration}s`;
    
    // Add the sparkle to the element
    element.appendChild(sparkle);
    
    // Remove the sparkle after it fades out
    setTimeout(() => {
        if (element.contains(sparkle)) {
            element.removeChild(sparkle);
        }
    }, duration * 1000);
}

/**
 * Add a random sparkle somewhere on the page
 */
function addRandomSparkle() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    
    // Only create sparkles occasionally
    if (Math.random() > 0.7) {
        createSparkleAtPosition(x, y);
    }
}

/**
 * Applies magical animations to headings
 */
function animateHeadings() {
    // Apply staggered reveal to article headings
    const headings = document.querySelectorAll('h3, h4');
    
    headings.forEach((heading, index) => {
        heading.style.opacity = "0";
        heading.style.transform = "translateY(20px)";
        heading.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        
        // Stagger the animations
        setTimeout(() => {
            heading.style.opacity = "1";
            heading.style.transform = "translateY(0)";
        }, 300 + (index * 150));
    });
}

/**
 * Adds magical hover effects to article images
 */
function addImageHoverEffects() {
    const articleImages = document.querySelectorAll('.article-img-container img');
    
    articleImages.forEach(image => {
        image.addEventListener('mouseenter', function() {
            // Create a magical glow effect
            const container = this.parentElement;
            container.style.boxShadow = "0 0 15px rgba(216, 173, 255, 0.6)";
            
            // Add a few sparkles
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const rect = container.getBoundingClientRect();
                    createSparkleAtPosition(
                        rect.left + Math.random() * rect.width,
                        rect.top + Math.random() * rect.height
                    );
                }, i * 200);
            }
        });
        
        image.addEventListener('mouseleave', function() {
            const container = this.parentElement;
            container.style.boxShadow = "";
        });
    });
}

/**
 * Makes the wax seal interactive
 */
function makeWaxSealInteractive() {
    const waxSeal = document.querySelector('.wax-seal');
    
    if (waxSeal) {
        waxSeal.addEventListener('mouseenter', function() {
            this.style.animation = "magicHover 1.5s ease-in-out infinite";
            
            // Create a burst of sparkles
            const rect = this.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 20 + Math.random() * 30;
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    
                    createSparkleAtPosition(x, y);
                }, i * 100);
            }
        });
        
        waxSeal.addEventListener('mouseleave', function() {
            this.style.animation = "floatElement 6s ease-in-out infinite";
        });
        
        // Make it respond to clicks with a magical effect
        waxSeal.addEventListener('click', function() {
            // Create a circular burst of sparkles
            const rect = this.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const angle = (i / 20) * Math.PI * 2;
                    const distance = 40;
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    
                    createSparkleAtPosition(x, y);
                }, i * 50);
            }
            
            // Add a subtle page effect
            document.body.style.transition = "transform 0.5s ease";
            document.body.style.transform = "scale(0.98)";
            
            setTimeout(() => {
                document.body.style.transform = "scale(1)";
            }, 500);
        });
    }
}
