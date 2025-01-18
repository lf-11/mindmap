import { mindMapState } from '../config/state.js';

/**
 * Handles node click events
 * @param {Event} event - Click event
 * @param {Object} d - Node data
 */
export function handleNodeClick(event, d) {
    event.stopPropagation();
    
    // Reset previous selection
    mindMapState.getGroup().selectAll('.node rect')
        .classed('selected', false)
        .style('stroke', '#999');
    
    // Update selection
    const selectedNode = d3.select(this);
    selectedNode.select('rect')
        .classed('selected', true)
        .style('stroke', '#ff4444');
    
    mindMapState.setSelectedNode(d.id, d.label);
    
    // Update UI feedback
    const selectedNodeDisplay = document.getElementById('selectedNode');
    if (selectedNodeDisplay) {
        selectedNodeDisplay.innerHTML = `Selected Node: ${d.label} (ID: ${d.id})`;
    }
}

/**
 * Clears node selection when clicking on empty space
 */
export function clearSelection() {
    mindMapState.getGroup().selectAll('.node rect')
        .classed('selected', false)
        .style('stroke', '#999');
    
    mindMapState.setSelectedNode(null, null);
    
    const selectedNodeDisplay = document.getElementById('selectedNode');
    if (selectedNodeDisplay) {
        selectedNodeDisplay.innerHTML = 'Selected Node: None';
    }
}

/**
 * Handles window resize events
 */
export function handleResize() {
    const container = document.getElementById('mindmap');
    if (!container) return;
    
    const svg = mindMapState.getSvg();
    if (!svg) return;
    
    // Update dimensions
    mindMapState.setDimensions(container.clientWidth, container.clientHeight);
    
    // Update SVG size
    svg
        .attr('width', mindMapState.getDimensions().width)
        .attr('height', mindMapState.getDimensions().height);
} 