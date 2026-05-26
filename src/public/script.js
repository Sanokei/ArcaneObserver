document.addEventListener('DOMContentLoaded', () => {
  normalizeImages();

  document.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (event.altKey) {
        event.preventDefault();
        anchor.click();
      }
    });
  });

  resizeAllShapes();

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resizeAllShapes).observe(document.body);
  }

  if (typeof initSmartCrop === 'function') {
    initSmartCrop();
  }
});

function normalizeImages() {
  for (const image of document.querySelectorAll('img')) {
    const source = image.getAttribute('src')?.trim();
    if (!source) {
      image.remove();
      continue;
    }

    try {
      const url = new URL(source, window.location.origin);
      if (
        url.origin !== window.location.origin &&
        (url.protocol === 'http:' || url.protocol === 'https:')
      ) {
        image.src = `/proxy-image?url=${encodeURIComponent(url.toString())}`;
      }
    } catch {
      // Keep malformed or relative sources untouched; the browser can handle them.
    }
  }
}

function resizeAllShapes() {
  for (const cell of document.querySelectorAll('.article')) {
    const text = cell.querySelector('.text');
    const heading = cell.querySelector('h4, h5');
    if (!text || !heading) {
      continue;
    }

    const directImages = Array.from(cell.children).filter(
      (child) => child instanceof HTMLImageElement,
    );
    const imageHeight = directImages.reduce(
      (height, image) => height + getOuterHeight(image),
      0,
    );
    const contentHeight = getOuterHeight(heading) + text.clientHeight + imageHeight;
    cell.style.height = `${contentHeight}px`;
  }
}

function getOuterHeight(element) {
  const styles = window.getComputedStyle(element);
  return (
    element.getBoundingClientRect().height +
    parseFloat(styles.marginTop || '0') +
    parseFloat(styles.marginBottom || '0')
  );
}
