import * as config from '../config/config.js';
import { mindMapState } from '../config/state.js';
import { createNodeGroup, createConnection } from './Node.js';
import { generateOrthogonalPath } from '../layout/PathGenerator.js';

/**
 * Animates the addition of a new node and its connection
 * @param {Object} animationData - Node data including position, type, and parent/source node info
 * @param {Function} handleNodeClick - Click handler function
 * @param {Map} treeNodesMap - Map of all TreeNode instances by ID (optional, for context)
 */
export async function addNodeWithAnimation(animationData, handleNodeClick, treeNodesMap) {
    // animationData contains targetNode properties (id, x, y, width, height, label, type, parentId)
    // and sourceNode (the parent TreeNode object, or null if root)
    
    const g = mindMapState.getGroup();
    const targetNode = animationData; // The node to be added and rendered
    const sourceNode = animationData.sourceNode; // The parent TreeNode object

    // If it has a parent (sourceNode exists), create and animate the connection first
    if (sourceNode && targetNode.parentId) {
        // createConnection handles path generation based on node types and junction points
        const link = createConnection(sourceNode, targetNode);
        
        if (link && !link.empty() && link.attr('d') && link.attr('d') !== "") { 
            await new Promise(resolve => {
                animateConnection(link, resolve);
            });
        }
    }

    // Create node group at its final position after path animation (if any)
    // createNodeGroup expects data like id, label, x, y, width, height, type
    createNodeGroup(targetNode, handleNodeClick);
}

/**
 * Animates a connection path growing from source to target
 * @param {Object} link - D3 selection of the path element
 * @param {Function} onComplete - Callback to run when animation completes
 */
export function animateConnection(link, onComplete) {
    const totalLength = link.node().getTotalLength();
    if (totalLength === 0) { // No length, complete immediately
        if (onComplete) onComplete();
        return;
    }

    let duration = (totalLength / config.ANIMATION.SPEED_PPS) * 1000; // ms

    // Apply min/max duration constraints if they are defined in config
    if (config.ANIMATION.MAX_PATH_DURATION) {
        duration = Math.min(duration, config.ANIMATION.MAX_PATH_DURATION);
    }
    if (config.ANIMATION.MIN_PATH_DURATION) {
        duration = Math.max(duration, config.ANIMATION.MIN_PATH_DURATION);
    }

    link
        .attr('stroke-dasharray', totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(duration) // Use calculated duration
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', function() {
            d3.select(this)
                .attr('stroke-dasharray', null)
                .attr('stroke-dashoffset', null);
            if (onComplete) onComplete();
        });
} 