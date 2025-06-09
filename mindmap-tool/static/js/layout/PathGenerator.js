import { LAYOUT } from '../config/config.js'; // If needed for path calculations

/**
 * Generates path data between two nodes for the PDF reader layout.
 * @param {TreeNode} sourceNode - The source TreeNode object.
 * @param {TreeNode} targetNode - The target TreeNode object.
 * @returns {Object} Path data with SVG path string and total length.
 */
export function generateOrthogonalPath(sourceNode, targetNode) {
    let path = "";
    let length = 0; // Length calculation can be removed if not strictly used by animations

    // Ensure junctionPoints exist or provide defaults (though TreeLayout should set them)
    const sourceJunctions = sourceNode.junctionPoints || {};
    const targetJunctions = targetNode.junctionPoints || {};

    const sx = sourceNode.x;
    const sy = sourceNode.y;
    const sw = sourceNode.width;
    const sh = sourceNode.height;

    const tx = targetNode.x;
    const ty = targetNode.y;
    const tw = targetNode.width;
    const th = targetNode.height;

    // Get parent's main vertical exit point (from TreeLayout)
    // Default if not set: sourceNode.x + LAYOUT.VERTICAL_TRUNK_NODE_OFFSET
    const parentTrunkExitX = sourceJunctions.parentExitX !== undefined ? sourceJunctions.parentExitX : sx + LAYOUT.VERTICAL_TRUNK_NODE_OFFSET;
    
    // Default attachment for target: its left edge, vertical center
    const targetDefaultAttachX = tx;
    const targetDefaultAttachY = ty + th / 2;

    // Case 1: Connecting to a Content Node
    if (targetNode.type === 'content' && sourceNode.type.startsWith('header')) {
        const parentExitYAtContentLevel = ty + LAYOUT.CONTENT_TEXT_PADDING; // Align with where content text starts vertically

        // Path: From parent's trunk exit (parentTrunkExitX), down/up to content's vertical alignment, then horizontal to content's left edge (tx)
        path = `M ${parentTrunkExitX} ${sy + sh} V ${parentExitYAtContentLevel} H ${tx}`;

    // Case 2: Connecting to a Sub-Header that uses the shared bus (because sibling content exists)
    } else if (targetNode.type.startsWith('header') && 
               sourceNode.type.startsWith('header') &&
               sourceJunctions.subHeaderBusY !== undefined && 
               sourceJunctions.subHeaderTrunkX !== undefined) {
        
        // This sub-header connects to the vertical trunk defined by subHeaderTrunkX,
        // which is fed by a horizontal bus at subHeaderBusY.

        const busY = sourceJunctions.subHeaderBusY;
        const verticalFeederTrunkX = sourceJunctions.subHeaderTrunkX;
        const targetAttachY = ty + th / 2; // Target header's vertical midpoint

        // Path:
        // 1. From source's main vertical trunk (parentTrunkExitX at source's bottom) down to busY
        // 2. Horizontally along busY from parentTrunkExitX to verticalFeederTrunkX
        // 3. Vertically along verticalFeederTrunkX from busY to target's vertical midpoint (targetAttachY)
        // 4. Horizontally from verticalFeederTrunkX to target's left edge (tx)
        
        path = `M ${parentTrunkExitX} ${sy + sh} ` + // Start at parent's trunk bottom
               `V ${busY} ` +                       // Down to bus
               `H ${verticalFeederTrunkX} ` +       // Across to sub-header's vertical trunk
               `V ${targetAttachY} ` +              // Up/Down along that trunk to target's Y
               `H ${tx}`;                           // Across to target's left edge

    // Case 3: Standard connection from Title or Header to another Header (simpler L-bend)
    // This handles title -> header_l1, or header_l1 -> header_l2 (if no content sibling caused a bus)
    } else if (targetNode.type.startsWith('header') && (sourceNode.type === 'title' || sourceNode.type.startsWith('header'))) {
        const sourceExitY = sy + sh; // Bottom of source node
        const targetAttachY = ty + th / 2; // Vertical midpoint of target node

        // Path: Down from parent's trunk exit (parentTrunkExitX), then horizontal to target's left edge (tx) at target's vertical midpoint.
        path = `M ${parentTrunkExitX} ${sourceExitY} V ${targetAttachY} H ${tx}`;
    
    } else {
        // Fallback or unhandled connection type - good to log this
        console.warn(`PathGenerator: Unhandled connection type from ${sourceNode.type} (id: ${sourceNode.id}) to ${targetNode.type} (id: ${targetNode.id})`);
        path = ""; // No path
    }
    
    // Simple length calculation (Manhattan distance for the primary segments) - can be refined if needed
    // For now, if path is non-empty, it will be rendered. Length is for animation.
    // If your animateConnection function doesn't use actual path length, this can be simplified/removed.
    length = path ? 100 : 0; // Dummy length if path exists, otherwise 0.

    return { path, length };
} 