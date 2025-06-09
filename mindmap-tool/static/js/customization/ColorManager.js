import { mindMapState } from '../config/state.js';

export function initColorCustomization() {
    // Background and grid
    const bgColorPicker = document.getElementById('bgColor');
    const dotColorPicker = document.getElementById('dotColor');
    const dotOpacitySlider = document.getElementById('dotOpacity');
    
    // Paths
    const pathColorPicker = document.getElementById('pathColor');
    const pathOpacitySlider = document.getElementById('pathOpacity');
    
    // Nodes
    const nodeFillColorPicker = document.getElementById('nodeFillColor');
    const nodeBorderColorPicker = document.getElementById('nodeBorderColor');
    const textColorPicker = document.getElementById('textColor');

    function updateBackground() {
        const svg = mindMapState.getSvg();
        if (!svg || !svg.node()) { // Ensure SVG is available
            console.warn("SVG not available for background update");
            return;
        }
        
        // Update background color
        const patternRect = svg.select('pattern rect');
        if (!patternRect.empty()) {
            patternRect.attr('fill', bgColorPicker.value);
        } else {
            console.warn("Pattern rect not found for background update");
        }
        
        // Update dots
        const dotOpacity = dotOpacitySlider.value / 100;
        const dotColor = dotColorPicker.value;
        
        const firstDot = svg.select('pattern circle:first-of-type');
        if (!firstDot.empty()) {
            firstDot.attr('fill', `${dotColor}${Math.round(dotOpacity * 255).toString(16).padStart(2, '0')}`);
        }
        
        const lastDot = svg.select('pattern circle:last-of-type');
        if (!lastDot.empty()) {
            lastDot.attr('fill', `${dotColor}${Math.round(dotOpacity * 0.3 * 255).toString(16).padStart(2, '0')}`);
        }
    }

    function updatePaths() {
        const svg = mindMapState.getSvg(); // Ensure we have SVG context if needed for d3.selectAll
        if (!svg || !svg.node()) {
             // d3.selectAll might work globally, but good practice to check if dependent on mindMapState.getSvg()
        }
        const pathOpacity = pathOpacitySlider.value / 100;
        const pathColor = pathColorPicker.value;
        
        d3.selectAll('.link')
            .style('stroke', pathColor)
            .style('opacity', pathOpacity);
    }

    function updateNodes() {
        const svg = mindMapState.getSvg(); // Ensure we have SVG context
        if (!svg || !svg.node()) {
            // d3.selectAll might work globally
        }
        d3.selectAll('.node rect')
            .style('fill', nodeFillColorPicker.value)
            .style('stroke', nodeBorderColorPicker.value);
        
        d3.selectAll('.node text')
            .style('fill', textColorPicker.value);
    }

    // Add event listeners
    bgColorPicker.addEventListener('input', updateBackground);
    dotColorPicker.addEventListener('input', updateBackground);
    dotOpacitySlider.addEventListener('input', updateBackground);
    
    pathColorPicker.addEventListener('input', updatePaths);
    pathOpacitySlider.addEventListener('input', updatePaths);
    
    nodeFillColorPicker.addEventListener('input', updateNodes);
    nodeBorderColorPicker.addEventListener('input', updateNodes);
    textColorPicker.addEventListener('input', updateNodes);

    // Call update functions once at initialization to apply default values from HTML
    // Ensure this is called after the SVG is expected to be ready
    if (mindMapState.getSvg() && mindMapState.getSvg().node()) {
        updateBackground();
        updatePaths();
        updateNodes();
    } else {
        // If SVG might not be ready, defer or listen for an event
        // For now, let's assume it's generally ready or the functions handle null SVG
        console.warn("ColorManager: SVG not immediately available on init. Initial colors might rely on SVG defaults.");
        // A more robust solution might involve an event like 'svgInitialized'
        // or ensuring initColorCustomization is called after SVG is definitely ready.
        // However, for immediate application from pickers, let's try calling them.
        // The internal checks in update functions will prevent errors if SVG isn't there.
        updateBackground();
        updatePaths();
        updateNodes();
    }
} 