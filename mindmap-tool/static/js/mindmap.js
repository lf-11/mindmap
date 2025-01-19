import * as config from './config/config.js';
import { mindMapState } from './config/state.js';
import { generateOrthogonalPath } from './layout/PathGenerator.js';
import { calculateSubtreeDimensions, calculateNewLayout } from './layout/TreeLayout.js';
import { createNodeGroup, createConnection } from './components/Node.js';
import { addNodeWithAnimation } from './components/Animation.js';
import { connectWebSocket } from './network/WebSocket.js';
import { createMindmap, createRootNode, addChildNode, loadMindmapStructure } from './network/ApiClient.js';
import { handleNodeClick, clearSelection, handleResize } from './utils/EventHandlers.js';
import { getAvailableStructures } from './examples/structures.js';
import { buildStructure } from './examples/MindmapBuilder.js';
import { initColorCustomization } from './customization/ColorManager.js';

// Initialize the network when the page loads
function initNetwork() {
    const container = document.getElementById('mindmap');
    mindMapState.setDimensions(container.clientWidth, container.clientHeight);

    const svg = d3.select('#mindmap')
        .append('svg')
        .attr('width', mindMapState.getDimensions().width)
        .attr('height', mindMapState.getDimensions().height)
        .on('click', clearSelection);
    
    mindMapState.setSvg(svg);

    // Set initial transform
    const initialTransform = d3.zoomIdentity.translate(mindMapState.getDimensions().width/2, 60).scale(1);
    mindMapState.setCurrentTransform(initialTransform);

    // Add grid pattern definition
    const defs = svg.append('defs');

    // Get viewport dimensions
    const viewportWidth = mindMapState.getDimensions().width;
    const viewportHeight = mindMapState.getDimensions().height;

    // Create pattern
    const pattern = defs.append('pattern')
        .attr('id', 'grid-pattern')
        .attr('width', 30)        // Larger spacing between dots
        .attr('height', 30)
        .attr('patternUnits', 'userSpaceOnUse');

    // Add background
    pattern.append('rect')
        .attr('width', 30)
        .attr('height', 30)
        .attr('fill', '#0A0A0A');

    // Create a single dot in the pattern
    pattern.append('circle')
        .attr('cx', 2)
        .attr('cy', 2)
        .attr('r', 0.8)
        .attr('fill', 'rgba(255, 255, 255, 0.08)');  // Very subtle dots

    // Add background rect with pattern
    const backgroundRect = svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#grid-pattern)');

    // Add subtle vignette effect
    const gradientId = 'radial-fade';
    const gradient = defs.append('radialGradient')
        .attr('id', gradientId)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '85%');

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('style', 'stop-color: #0A0A0A; stop-opacity: 0.1');

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('style', 'stop-color: #0A0A0A; stop-opacity: 0.3');

    // Add gradient overlay
    svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', `url(#${gradientId})`);

    const g = svg.append('g')
        .attr('transform', mindMapState.getCurrentTransform());
    mindMapState.setGroup(g);

    // Initialize tree layout with modified separation logic
    const treeLayout = d3.tree()
        .nodeSize([config.NODE_WIDTH * 2, config.BASE_VERTICAL_SPACING])
        .separation((a, b) => {
            const aWidth = calculateSubtreeDimensions(a).width;
            const bWidth = calculateSubtreeDimensions(b).width;
            
            if (a.parent === b.parent) {
                return config.MIN_NODE_SEPARATION / config.NODE_WIDTH;
            }
            
            return (aWidth + bWidth) / (2 * config.NODE_WIDTH) + config.MIN_SUBTREE_SEPARATION / config.NODE_WIDTH;
        });
    
    mindMapState.setTreeLayout(treeLayout);

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([config.ZOOM_SETTINGS.MIN_SCALE, config.ZOOM_SETTINGS.MAX_SCALE])
        .on('zoom', (event) => {
            mindMapState.setCurrentTransform(event.transform);
            mindMapState.getGroup().attr('transform', event.transform);
        });

    svg.call(zoom);
    svg.call(zoom.transform, initialTransform);

    // Add window resize handler
    window.addEventListener('resize', handleResize);
}

function initStructureSelector() {
    const select = document.getElementById('structureSelect');
    const structures = getAvailableStructures();
    
    structures.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initNetwork();
    initStructureSelector();
    initColorCustomization();
});

// Export functions that need to be accessible from HTML
window.createMindmap = createMindmap;
window.createRootNode = createRootNode;
window.addChildNode = addChildNode;
window.loadMindmapStructure = loadMindmapStructure;
window.buildSelectedStructure = () => {
    const select = document.getElementById('structureSelect');
    const selectedStructure = select.value;
    if (selectedStructure) {
        buildStructure(selectedStructure);
    } else {
        alert('Please select a structure first');
    }
}; 