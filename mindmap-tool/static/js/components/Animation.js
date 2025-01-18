import * as config from '../config/config.js';
import { mindMapState } from '../config/state.js';
import { generateOrthogonalPath } from '../layout/PathGenerator.js';
import { calculateNewLayout } from '../layout/TreeLayout.js';
import { createNodeGroup, createConnection } from './Node.js';

/**
 * Animates the addition of a new node and its connection
 * @param {Object} parentNode - Parent node data
 * @param {Object} childNode - Child node data
 * @param {Function} handleNodeClick - Click handler function
 */
export async function addNodeWithAnimation(parentNode, childNode, handleNodeClick) {
    console.log('Adding node with animation:', {parent: parentNode, child: childNode});
    
    childNode.parent_id = parentNode.id;
    const g = mindMapState.getGroup();

    const tempId = 'temp_' + Date.now();
    const newPositions = calculateNewLayout(
        parentNode.id, 
        tempId, 
        g.selectAll('.node').data(),
        mindMapState.getTreeLayout()
    );

    // First Phase: Move existing nodes and their connections
    await moveExistingNodes(newPositions);

    // Second Phase: Add new node and animate its connection
    await new Promise(resolve => {
        setTimeout(() => {
            const newNodePos = newPositions.get(tempId);
            const parentPos = newPositions.get(parentNode.id);
            
            if (!newNodePos || !parentPos) {
                console.error('Failed to get positions');
                return;
            }

            // Create new node
            createNodeGroup({
                ...childNode,
                x: newNodePos.x,
                y: newNodePos.y
            }, handleNodeClick);

            // Create and animate the connection
            const link = createConnection(parentPos, newNodePos, childNode.id);
            animateConnection(link);

            resolve();
        }, config.ANIMATION.TRANSITION_DELAY);
    });
}

/**
 * Moves existing nodes and their connections to new positions
 * @param {Map} newPositions - Map of node IDs to their new positions
 */
async function moveExistingNodes(newPositions) {
    const g = mindMapState.getGroup();
    const transitions = [];

    g.selectAll('.node').each(function(d) {
        const newPos = newPositions.get(d.id);
        if (newPos) {
            const node = d3.select(this);
            const nodeTransition = node.transition()
                .duration(config.ANIMATION.NODE_MOVEMENT)
                .ease(d3.easeQuadInOut)
                .attr('transform', `translate(${newPos.x},${newPos.y})`);
            
            transitions.push(nodeTransition);

            // Update associated link
            const link = g.select(`.link[data-target="${d.id}"]`);
            if (!link.empty()) {
                const parentPos = newPositions.get(d.parent_id);
                if (parentPos) {
                    const newPathData = generateOrthogonalPath(parentPos, newPos);
                    
                    const linkTransition = link.transition()
                        .duration(config.ANIMATION.NODE_MOVEMENT)
                        .ease(d3.easeQuadInOut)
                        .attr('d', newPathData.path);
                    
                    transitions.push(linkTransition);
                }
            }
        }
    });

    await Promise.all(transitions);
}

/**
 * Animates a connection path growing from source to target
 * @param {Object} link - D3 selection of the path element
 */
function animateConnection(link) {
    const totalLength = link.node().getTotalLength();

    link
        .style('stroke-dasharray', totalLength)
        .style('stroke-dashoffset', totalLength)
        .transition()
        .duration(config.ANIMATION.PATH_GROWTH)
        .ease(d3.easeLinear)
        .style('stroke-dashoffset', 0)
        .on('end', function() {
            d3.select(this)
                .style('stroke-dasharray', null)
                .style('stroke-dashoffset', null);
        });
} 