let activeColorId = 15; // Set default white
let isPainting = false;

// ANSI 256 Colors List
const getAnsiColors = () => {
  const colors = [];

  // 0-15: Standard and high-intensity colors
  const basic = [
    '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
    '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff'
  ];
  basic.forEach((c) => colors.push(c));

  // 16-231: 6x6x6 RGB cube
  const steps = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const hex = '#' +
          steps[r].toString(16).padStart(2, '0') +
          steps[g].toString(16).padStart(2, '0') +
          steps[b].toString(16).padStart(2, '0');
        colors.push(hex);
      }
    }
  }

  // 232-255: Grayscale
  for (let i = 0; i < 24; i++) {
    const shade = 8 + (i * 10);
    const hex = '#' + shade.toString(16).padStart(2, '0').repeat(3);
    colors.push(hex);
  }

  return colors;
};

const ansiColors = getAnsiColors();

const initPalette = () => {
  const paletteEl = document.getElementById('palette');
  paletteEl.innerHTML = ''; // Ensure clean start (e.g. if hot reloaded)

  let titleAdded = { basic: false, cube: false, gray: false };

  ansiColors.forEach((hex, idx) => {
    if (idx === 0) {
      paletteEl.insertAdjacentHTML('beforeend', `<div class="palette-section-title">Standard</div>`);
    } else if (idx === 16) {
      paletteEl.insertAdjacentHTML('beforeend', `<div class="palette-section-title">216 Colors</div>`);
    } else if (idx === 232) {
      paletteEl.insertAdjacentHTML('beforeend', `<div class="palette-section-title">Grayscale</div>`);
    }

    const cell = document.createElement('div');
    cell.className = 'palette-cell';
    cell.style.backgroundColor = hex;
    cell.dataset.ansi = idx;

    cell.addEventListener('click', () => {
      activeColorId = idx;
      document.getElementById('active-color-box').style.backgroundColor = hex;
      document.getElementById('active-color-text').textContent = `Active Color: #${idx} ${idx === 15 ? '(White)' : ''}`;
    });

    paletteEl.appendChild(cell);
  });
};

const renderText = (text) => {
  const editorEl = document.getElementById('editor');
  editorEl.innerHTML = ''; // clear

  const lines = text.split('\n');

  lines.forEach((line) => {
    // Keep trailing empty lines intact without adding \r
    line = line.replace(/\r$/, '');
    
    // Empty line case: add a zero-width space or a normal space to keep height
    if(line === '') line = ' '; 

    const lineContainer = document.createElement('div');
    lineContainer.className = 'line';

    // Parse ANSI sequences per line
    // This splits the line into text and ansi code matches alternately.
    // e.g. "A\x1b[38;5;1mB" -> ["A", "38;5;1", "B"]
    const parts = line.split(/\x1b\[([\d;]+)m/);
    let currentColorId = null;

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        // ANSI sequence matched block
        const code = parts[i];
        if (code === '0') {
          currentColorId = null;
        } else if (code.startsWith('38;5;')) {
          currentColorId = parseInt(code.split(';')[2], 10);
        }
      } else {
        // Text block
        const textSegment = parts[i];
        for (let j = 0; j < textSegment.length; j++) {
          const char = textSegment[j];
          const span = document.createElement('span');
          span.textContent = char;
          
          if (currentColorId !== null) {
            span.style.color = ansiColors[currentColorId];
            span.dataset.ansi = parseInt(currentColorId, 10);
          }

          span.addEventListener('mousedown', (e) => {
            isPainting = true;
            span.style.color = ansiColors[activeColorId];
            span.dataset.ansi = activeColorId;
          });

          span.addEventListener('mouseover', (e) => {
            if (isPainting) {
              span.style.color = ansiColors[activeColorId];
              span.dataset.ansi = activeColorId;
            }
          });
          
          lineContainer.appendChild(span);
        }
      }
    }
    editorEl.appendChild(lineContainer);
  });
};

const setupDragAndDrop = () => {
  const dropZone = document.getElementById('drop-zone');
  const fileUpload = document.getElementById('file-upload');

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      renderText(e.target.result);
    };
    reader.readAsText(file);
  };

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
    e.target.value = ''; // reset
  });
};

document.addEventListener('mouseup', () => {
  isPainting = false;
});

const exportANSI = () => {
  const editorEl = document.getElementById('editor');
  const lines = editorEl.querySelectorAll('.line');
  if (lines.length === 0) return;

  let result = '';

  lines.forEach(line => {
    const spans = line.querySelectorAll('span');
    let currentColor = null;

    spans.forEach(span => {
      const charColor = span.dataset.ansi;

      if (charColor !== currentColor) {
        if (charColor) {
          result += `\x1b[38;5;${charColor}m`;
        } else {
          result += `\x1b[0m`; // reset
        }
        currentColor = charColor;
      }
      
      result += span.textContent;
    });

    if (currentColor) {
      result += `\x1b[0m`; // reset at end of line
    }
    result += '\n'; // newline
  });

  // Create downloadable file
  const blob = new Blob([result], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'colored_art.txt';
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('download-btn').addEventListener('click', exportANSI);

document.getElementById('reset-btn').addEventListener('click', () => {
  const spans = document.querySelectorAll('#editor span');
  spans.forEach(span => {
    span.style.color = '';
    delete span.dataset.ansi;
  });
});

let currentZoom = 1;
const updateZoom = (delta) => {
  currentZoom += delta;
  currentZoom = Math.max(0.4, Math.min(currentZoom, 4.0)); // Clamp between 40% and 400%
  document.getElementById('editor').style.setProperty('--zoom', currentZoom);
  document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
};

document.getElementById('zoom-in').addEventListener('click', () => updateZoom(0.2));
document.getElementById('zoom-out').addEventListener('click', () => updateZoom(-0.2));

// Pre-load default_load.txt if available via dev server
fetch('default_load.txt')
  .then(response => {
    if (response.ok) return response.text();
    throw new Error('Fallback logic');
  })
  .then(text => renderText(text))
  .catch(err => {
    // Leave placeholder active
  });

initPalette();
setupDragAndDrop();
