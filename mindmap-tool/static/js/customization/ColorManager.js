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
        
        // Update background color
        svg.select('pattern rect').attr('fill', bgColorPicker.value);
        
        // Update dots
        const dotOpacity = dotOpacitySlider.value / 100;
        const dotColor = dotColorPicker.value;
        
        svg.select('pattern circle:first-of-type')
            .attr('fill', `${dotColor}${Math.round(dotOpacity * 255).toString(16).padStart(2, '0')}`);
        
        svg.select('pattern circle:last-of-type')
            .attr('fill', `${dotColor}${Math.round(dotOpacity * 0.3 * 255).toString(16).padStart(2, '0')}`);
    }

    function updatePaths() {
        const pathOpacity = pathOpacitySlider.value / 100;
        const pathColor = pathColorPicker.value;
        
        d3.selectAll('.link')
            .style('stroke', pathColor)
            .style('opacity', pathOpacity);
    }

    function updateNodes() {
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
} 