/**
 * Generates an orthogonal path between two points with calculated total length
 * @param {Object} source - Source point with x, y coordinates
 * @param {Object} target - Target point with x, y coordinates
 * @returns {Object} Path data with SVG path string and total length
 */
export function generateOrthogonalPath(source, target) {
    const midY = (source.y + target.y) / 2;
    
    // Calculate path segments
    const verticalLength1 = Math.abs(midY - source.y);
    const horizontalLength = Math.abs(target.x - source.x);
    const verticalLength2 = Math.abs(target.y - midY);
    
    // Create the path
    const path = `M ${source.x} ${source.y}
                  V ${midY}
                  H ${target.x}
                  V ${target.y}`;
    
    // Calculate total length
    const length = verticalLength1 + horizontalLength + verticalLength2;
    
    return { path, length };
} 