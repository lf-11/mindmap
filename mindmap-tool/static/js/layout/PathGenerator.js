/**
 * Generates an orthogonal path between two points with calculated total length
 * @param {Object} source - Source point with x, y coordinates
 * @param {Object} target - Target point with x, y coordinates
 * @returns {Object} Path data with SVG path string and total length
 */
export function generateOrthogonalPath(source, target) {
    // Check if nodes are vertically aligned (within a small threshold)
    const alignmentThreshold = 5;  // pixels
    const isVerticallyAligned = Math.abs(source.x - target.x) < alignmentThreshold;
    
    if (isVerticallyAligned) {
        // Generate straight vertical path
        const path = `M ${source.x} ${source.y} V ${target.y}`;
        const length = Math.abs(target.y - source.y);
        return { path, length };
    }
    
    // Otherwise, generate standard orthogonal path
    const midY = (source.y + target.y) / 2;
    const verticalLength1 = Math.abs(midY - source.y);
    const horizontalLength = Math.abs(target.x - source.x);
    const verticalLength2 = Math.abs(target.y - midY);
    
    const path = `M ${source.x} ${source.y}
                  V ${midY}
                  H ${target.x}
                  V ${target.y}`;
    
    const length = verticalLength1 + horizontalLength + verticalLength2;
    return { path, length };
} 