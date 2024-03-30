
// removes the alt-click functionality
document.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', function (e) {
    if (e.altKey) {
      e.preventDefault(); // no download
      this.click(); // fake a normal click
    }
  });
});

function resizeAllShapes() {
  for (const cell of [...document.querySelectorAll('.article')]) {
    let currentCellHeight, textHeight

    do {
      currentCellHeight = Number(cell.style.height.replace('px', ''))
      textHeight = cell.querySelector('.text').clientHeight + cell.querySelector('h4').clientHeight //+ cell.querySelector('img').clientHeight
      cell.style.height = `${textHeight}px`
    } while (currentCellHeight !== textHeight)
  }
}

new ResizeObserver(resizeAllShapes).observe(document.body) 