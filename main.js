let activeColorId = 15; // Set default white
let isPainting = false;
let currentMode = 'color';
let selectedSpan = null;
let brailleData = null;

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

const initBraillePalette = async () => {
  const paletteEl = document.getElementById('braille-palette');
  const statusEl = document.getElementById('selection-status');
  
  try {
    const response = await fetch('private/braille.json');
    brailleData = await response.json();
    
    paletteEl.innerHTML = '';
    
    // Sort keys numerically
    const keys = Object.keys(brailleData).sort((a, b) => parseInt(a) - parseInt(b));
    
    keys.forEach(dotCount => {
      const chars = brailleData[dotCount];
      if (!chars || chars.length === 0) return;

      const group = document.createElement('div');
      group.className = 'braille-group';
      
      const title = document.createElement('div');
      title.className = 'braille-group-title';
      title.textContent = `${dotCount} Dots`;
      group.appendChild(title);
      
      const grid = document.createElement('div');
      grid.className = 'braille-grid';
      
      // Each character is a cell
      chars.split('').forEach(char => {
        const cell = document.createElement('div');
        cell.className = 'braille-cell';
        cell.textContent = char;
        cell.title = `${dotCount} dots`;
        
        cell.addEventListener('click', () => {
          if (currentMode === 'edit' && selectedSpan) {
            selectedSpan.textContent = char;
          }
        });
        
        grid.appendChild(cell);
      });
      
      group.appendChild(grid);
      paletteEl.appendChild(group);
    });
    
    updateEditPaletteState();
    
  } catch (error) {
    console.error('Failed to load braille data:', error);
    paletteEl.innerHTML = '<div class="error">Failed to load Braille data.</div>';
  }
};

const updateEditPaletteState = () => {
  const paletteEl = document.getElementById('braille-palette');
  const statusEl = document.getElementById('selection-status');
  
  if (selectedSpan) {
    paletteEl.classList.remove('disabled-palette');
    statusEl.innerHTML = `Editing character: <span style="font-size: 1.5rem; vertical-align: middle; margin-left: 5px;">${selectedSpan.textContent}</span>`;
    statusEl.classList.add('has-selection');
  } else {
    paletteEl.classList.add('disabled-palette');
    statusEl.textContent = 'Select a character in the display to edit';
    statusEl.classList.remove('has-selection');
  }
};

const selectChar = (span) => {
  if (selectedSpan) {
    selectedSpan.classList.remove('selected-char');
  }
  
  if (selectedSpan === span) {
    selectedSpan = null;
  } else {
    selectedSpan = span;
    if (selectedSpan) {
      selectedSpan.classList.add('selected-char');
      selectedSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }
  
  updateEditPaletteState();
};

const createCharSpan = (char, colorId = null) => {
  const span = document.createElement('span');
  span.textContent = char;
  
  if (colorId !== null) {
    span.style.color = ansiColors[colorId];
    span.dataset.ansi = parseInt(colorId, 10);
  }

  span.addEventListener('mousedown', (e) => {
    if (currentMode === 'color') {
      isPainting = true;
      span.style.color = ansiColors[activeColorId];
      span.dataset.ansi = activeColorId;
    }
    
    // Shared selection behavior
    selectChar(span);
  });

  span.addEventListener('mouseover', (e) => {
    if (currentMode === 'color' && isPainting) {
      span.style.color = ansiColors[activeColorId];
      span.dataset.ansi = activeColorId;
    }
  });

  return span;
};

const switchMode = (mode) => {
  currentMode = mode;
  
  // Update tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  
  // Update content visibility
  document.querySelectorAll('.mode-content').forEach(content => {
    content.classList.toggle('active', content.id === `${mode}-mode-content`);
  });

  updateEditPaletteState();
};

window.addEventListener('keydown', (e) => {
  if (!selectedSpan) return;

  // Arrow Navigation (Both Modes)
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    let next = null;

    if (e.key === 'ArrowLeft') {
      next = selectedSpan.previousElementSibling;
      if (!next) {
        const prevLine = selectedSpan.parentElement.previousElementSibling;
        if (prevLine && prevLine.classList.contains('line')) {
          next = prevLine.lastElementChild;
        }
      }
    } else if (e.key === 'ArrowRight') {
      next = selectedSpan.nextElementSibling;
      if (!next) {
        const nextLine = selectedSpan.parentElement.nextElementSibling;
        if (nextLine && nextLine.classList.contains('line')) {
          next = nextLine.firstElementChild;
        }
      }
    } else if (e.key === 'ArrowUp') {
      const line = selectedSpan.parentElement;
      const index = Array.from(line.children).indexOf(selectedSpan);
      const prevLine = line.previousElementSibling;
      if (prevLine && prevLine.classList.contains('line')) {
        next = prevLine.children[Math.min(index, prevLine.children.length - 1)];
      }
    } else if (e.key === 'ArrowDown') {
      const line = selectedSpan.parentElement;
      const index = Array.from(line.children).indexOf(selectedSpan);
      const nextLine = line.nextElementSibling;
      if (nextLine && nextLine.classList.contains('line')) {
        next = nextLine.children[Math.min(index, nextLine.children.length - 1)];
      }
    }

    if (next && next.tagName === 'SPAN') {
      selectChar(next);
    }
    return;
  }

  // Edit Mode Specific Keys
  if (currentMode === 'edit') {
    if (e.key === ' ') {
      e.preventDefault();
      const newSpan = createCharSpan('⠀');
      selectedSpan.after(newSpan);
      
      // Selection advances to the right
      selectChar(newSpan);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const toDelete = selectedSpan.previousElementSibling;
      if (toDelete && toDelete.tagName === 'SPAN') {
        toDelete.remove();
        updateEditPaletteState();
      } else {
        // At start of line, merge with previous line
        const currentLine = selectedSpan.parentElement;
        const prevLine = currentLine.previousElementSibling;
        if (prevLine && prevLine.classList.contains('line')) {
          // Move all spans from current line to the end of the previous line
          const spans = Array.from(currentLine.children);
          spans.forEach(span => prevLine.appendChild(span));
          currentLine.remove();
          // selection remains on the same span (now part of prevLine)
          updateEditPaletteState();
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentLine = selectedSpan.parentElement;
      const newLine = document.createElement('div');
      newLine.className = 'line';
      
      // Move all elements from selectedSpan onwards to the new line
      let toMove = [selectedSpan];
      let sibling = selectedSpan.nextElementSibling;
      while (sibling) {
        toMove.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      
      toMove.forEach(span => newLine.appendChild(span));
      currentLine.after(newLine);
      
      // selection remains on selectedSpan (now at start of newLine)
      updateEditPaletteState();
    } else {
      // Ignore all other keys in Edit mode
      if (e.key.length === 1) {
        e.preventDefault();
      }
    }
  }
});

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
          const span = createCharSpan(char, currentColorId);
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

// Mode Tab Listeners
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

initPalette();
initBraillePalette();
setupDragAndDrop();
