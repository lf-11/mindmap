import * as config from '../config/config.js';
import { mindMapState } from '../config/state.js';
import { generateOrthogonalPath } from '../layout/PathGenerator.js';

/**
 * Creates a new node group in the SVG
 * @param {Object} nodeData - Data for the node
 * @param {Function} handleNodeClick - Click handler function
 * @returns {Object} D3 selection of the created node group
 */
export function createNodeGroup(nodeData, handleNodeClick) {
    const g = mindMapState.getGroup();
    
    // Calculate text width for proper rectangle sizing
    const tempText = g.append('text')
        .attr('visibility', 'hidden')
        .text(nodeData.label);
    const textWidth = tempText.node().getBBox().width;
    tempText.remove();
    
    // Use the larger of minimum width or text width plus padding
    const nodeWidth = Math.max(config.NODE_WIDTH, textWidth + 40);
    
    const nodeGroup = g.append('g')
        .attr('class', 'node')
        .attr('data-id', nodeData.id)
        .attr('transform', `translate(${nodeData.x},${nodeData.y})`)
        .on('click', handleNodeClick)
        .datum(nodeData);

    // Add rectangle with rounded corners
    nodeGroup.append('rect')
        .attr('x', -nodeWidth/2)
        .attr('y', -config.NODE_HEIGHT/2)
        .attr('width', nodeWidth)
        .attr('height', config.NODE_HEIGHT)
        .attr('rx', 5)
        .attr('ry', 5);

    // Add text centered in node
    nodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('dy', '0.1em')
        .text(nodeData.label);

    return nodeGroup;
}

/**
 * Creates a connection path between two nodes
 * @param {Object} sourcePos - Source node position
 * @param {Object} targetPos - Target node position
 * @param {string} targetId - ID of the target node
 * @returns {Object} D3 selection of the created path
 */
export function createConnection(sourcePos, targetPos, targetId) {
    const g = mindMapState.getGroup();
    const pathData = generateOrthogonalPath(sourcePos, targetPos);
    
    return g.insert('path', '.node')
        .attr('class', 'link')
        .attr('data-target', targetId)
        .attr('d', pathData.path);
} 