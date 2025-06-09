import { mindMapState } from '../config/state.js';

const VIEWPORT_TOP_MARGIN = 50; // pixels

let allSortedHeaders = [];
let availableLevels = []; // e.g., ['header_l1', 'header_l2', 'header_l3']
let navigationTargetNode = null; // The node we are currently animating towards.
let levelFilter = 'all'; // 'all', or a specific level like 'header_l1'
let displayEl = null;

function _getHumanReadableLevel(level) {
    if (level === 'all') return 'All Levels';
    if (level.startsWith('header_l')) {
        return `Level ${level.replace('header_l', '')}`;
    }
    return level;
}

function _updateDisplay() {
    if (!displayEl) return;
    displayEl.textContent = _getHumanReadableLevel(levelFilter);
}

function _animateToHeader(headerNode) {
    if (!headerNode) return;

    const previousLevelFilter = levelFilter; // Preserve filter state

    const svg = mindMapState.getSvg();
    const zoom = mindMapState.getZoom();
    const { width } = mindMapState.getDimensions();
    const currentTransform = mindMapState.getCurrentTransform();
    const currentScale = currentTransform.k;

    // --- REFINED HORIZONTAL LOGIC ---
    let newX = currentTransform.x;
    
    // Calculate where the node would appear on screen without horizontal adjustment
    const projectedScreenX_left = headerNode.x * currentScale + currentTransform.x;

    // Rule 1: Node starts beyond the 55% mark, pan left to bring it to the 50% mark.
    if (projectedScreenX_left > width * 0.55) {
        newX = (width * 0.50) - (headerNode.x * currentScale);
    } 
    // Rule 2: Node starts before the 10% mark, pan right to bring it to the 10% mark.
    else if (projectedScreenX_left < width * 0.10) {
        newX = (width * 0.10) - (headerNode.x * currentScale);
    }
    // --- END REFINED HORIZONTAL LOGIC ---

    const newY = VIEWPORT_TOP_MARGIN - headerNode.y * currentScale;

    const newTransform = d3.zoomIdentity.translate(newX, newY).scale(currentScale);

    svg.transition()
        .duration(750)
        .call(zoom.transform, newTransform)
        .on('end', () => {
            if (headerNode.id === navigationTargetNode?.id) {
                navigationTargetNode = null;
                levelFilter = previousLevelFilter; 
                _updateDisplay();
            }
        });
}

function handleNavigation(direction) {
    const startY = navigationTargetNode 
        ? navigationTargetNode.y 
        : (VIEWPORT_TOP_MARGIN - mindMapState.getCurrentTransform().y) / mindMapState.getCurrentTransform().k;
    
    const candidateHeaders = allSortedHeaders.filter(h => levelFilter === 'all' || h.type === levelFilter);

    if (candidateHeaders.length === 0) {
        console.warn(`No headers found for filter: ${levelFilter}`);
        return;
    }

    let nextHeader = null;

    if (direction === 'next') {
        nextHeader = candidateHeaders.find(h => h.y > startY + 1);
    } else { // 'prev'
        const prevHeaders = candidateHeaders.filter(h => h.y < startY - 1);
        nextHeader = prevHeaders.length > 0 ? prevHeaders[prevHeaders.length - 1] : null;
    }
    
    if (nextHeader) {
        navigationTargetNode = nextHeader;
        _updateDisplay();
        _animateToHeader(nextHeader);
    } else {
        console.log(`No ${direction} header found for level: ${levelFilter}`);
        navigationTargetNode = null;
        _updateDisplay();
    }
}

function handleChangeLevel(direction) {
    if (availableLevels.length === 0) return;

    let currentIndex = availableLevels.indexOf(levelFilter);

    if (levelFilter === 'all') {
        if (direction === 'down') {
            levelFilter = availableLevels[0];
        }
    } else if (currentIndex !== -1) {
        if (direction === 'up') {
            const newIndex = currentIndex - 1;
            levelFilter = newIndex < 0 ? 'all' : availableLevels[newIndex];
        } else { // 'down'
            const newIndex = currentIndex + 1;
            if (newIndex < availableLevels.length) {
                levelFilter = availableLevels[newIndex];
            }
        }
    }
    
    console.log("Level filter changed to:", levelFilter);
    navigationTargetNode = null; 
    _updateDisplay();
}

export function initNavigation() {
    const nextBtn = document.getElementById('next-header-btn');
    const prevBtn = document.getElementById('prev-header-btn');
    displayEl = document.getElementById('nav-level-display');

    if (!nextBtn || !prevBtn || !displayEl) {
        console.warn('Navigation UI elements not found. Skipping initialization.');
        return;
    }

    nextBtn.addEventListener('click', () => handleNavigation('next'));
    prevBtn.addEventListener('click', () => handleNavigation('prev'));

    window.addEventListener('keydown', (e) => {
        if (e.altKey) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    handleNavigation('next');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    handleNavigation('prev');
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handleChangeLevel('up');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleChangeLevel('down');
                    break;
            }
        }
    });

    _updateDisplay();
}

export function updateHeaderList(allLayoutNodes) {
    const headerNodeTypes = new Set(
        allLayoutNodes
            .map(node => node.type)
            .filter(type => type && type.startsWith('header_l'))
    );
    availableLevels = [...headerNodeTypes].sort();

    allSortedHeaders = allLayoutNodes
        .filter(node => availableLevels.includes(node.type))
        .sort((a, b) => a.y - b.y);
    
    levelFilter = 'all';
    navigationTargetNode = null;
    _updateDisplay();

    console.log(`Navigation initialized with ${allSortedHeaders.length} total headers across levels:`, availableLevels);
} 