import * as config from '../config/config.js';

/**
 * Calculates the dimensions of a subtree rooted at the given node
 * @param {Object} node - The root node of the subtree
 * @returns {Object} Dimensions including width and extents
 */
export function calculateSubtreeDimensions(node) {
    if (!node.children || node.children.length === 0) {
        return {
            width: config.NODE_WIDTH,
            leftExtent: config.NODE_WIDTH/2,
            rightExtent: config.NODE_WIDTH/2,
            center: 0
        };
    }

    // Calculate dimensions for all children
    const childrenDimensions = node.children.map(calculateSubtreeDimensions);

    // Calculate total width needed for children
    let totalChildrenWidth = 0;
    let maxChildExtent = 0;

    childrenDimensions.forEach((dim, i) => {
        totalChildrenWidth += dim.width;
        maxChildExtent = Math.max(maxChildExtent, dim.leftExtent, dim.rightExtent);
        
        // Add separation between siblings
        if (i < childrenDimensions.length - 1) {
            totalChildrenWidth += config.MIN_NODE_SEPARATION;
        }
    });

    // Calculate the center position relative to leftmost child
    const center = totalChildrenWidth / 2;

    return {
        width: Math.max(config.NODE_WIDTH, totalChildrenWidth),
        leftExtent: Math.max(config.NODE_WIDTH/2, center),
        rightExtent: Math.max(config.NODE_WIDTH/2, center),
        center: center,
        childrenDimensions: childrenDimensions
    };
}

/**
 * Calculates new layout positions for all nodes
 * @param {string} newNodeParentId - ID of the parent node for new node
 * @param {string} tempId - Temporary ID for the new node
 * @returns {Map} Map of node IDs to their new positions
 */
export function calculateNewLayout(newNodeParentId, tempId, currentNodes, treeLayout) {
    const tempNode = {
        id: tempId,
        parent_id: newNodeParentId,
        x: 0,
        y: 0,
        label: ''
    };
    
    const nodesWithNew = currentNodes.map(node => ({
        id: node.id,
        parent_id: node.parent_id,
        x: node.x,
        y: node.y,
        label: node.label
    }));
    nodesWithNew.push(tempNode);
    
    const hierarchy = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parent_id)(nodesWithNew);
    
    // Modify the tree layout configuration
    const treeData = treeLayout
        .nodeSize([
            config.NODE_WIDTH * 1.6,  // Increased from 1.3 to ensure enough horizontal space
            config.BASE_VERTICAL_SPACING * 0.9  // Adjusted vertical spacing
        ])
        .separation((a, b) => {
            const aWidth = calculateSubtreeDimensions(a).width;
            const bWidth = calculateSubtreeDimensions(b).width;
            
            if (a.parent === b.parent) {
                // Ensure minimum separation between siblings
                return (config.MIN_NODE_SEPARATION * 0.9) / config.NODE_WIDTH;
            }
            
            // Ensure enough separation between different subtrees
            return (aWidth + bWidth) / (2.2 * config.NODE_WIDTH) + 
                   (config.MIN_SUBTREE_SEPARATION * 0.9) / config.NODE_WIDTH;
        })(hierarchy);
    
    const rootX = treeData.x;
    
    // Convert to map of positions with proper spacing
    const positions = new Map();
    treeData.descendants().forEach(d => {
        if (d.parent) {
            const parentDim = calculateSubtreeDimensions(d.parent);
            const siblings = d.parent.children;
            
            // Check if this is the only child
            if (siblings.length === 1) {
                // Center single child directly under parent
                positions.set(d.data.id, {
                    x: d.parent.x - rootX,  // Align with parent
                    y: d.y
                });
            } else {
                const siblingIndex = siblings.indexOf(d);
                
                // Calculate cumulative width of previous siblings and their spacing
                let previousWidth = 0;
                for (let i = 0; i < siblingIndex; i++) {
                    const sibDim = calculateSubtreeDimensions(siblings[i]);
                    previousWidth += sibDim.width + config.MIN_NODE_SEPARATION;
                }
                
                // Position node considering its subtree's center
                const nodeDim = calculateSubtreeDimensions(d);
                const xOffset = previousWidth + nodeDim.center - parentDim.center;
                
                positions.set(d.data.id, {
                    x: (d.parent.x - rootX) + xOffset,
                    y: d.y
                });
            }
        } else {
            // Root node
            positions.set(d.data.id, {
                x: 0,
                y: d.y
            });
        }
    });
    
    return positions;
} 