import * as config from '../config/config.js';
import { mindMapState } from '../config/state.js';
import { generateOrthogonalPath } from '../layout/PathGenerator.js';
import { LAYOUT, NODE_WIDTH, NODE_HEIGHT } from '../config/config.js';

/**
 * Creates a new node group in the SVG
 * @param {Object} nodeData - TreeNode object including x, y, width, height, label, type, id
 * @param {Function} handleNodeClick - Click handler function
 * @returns {Object} D3 selection of the created node group
 */
export function createNodeGroup(nodeData, handleNodeClick) {
    return new Promise((resolve) => {
        const g = mindMapState.getGroup();
        
        const nodeWidth = nodeData.width || NODE_WIDTH;
        const nodeHeight = nodeData.height || NODE_HEIGHT;
        
        const nodeGroup = g.append('g')
            .attr('class', nodeData.isImage ? 'node image-node' : 'node')
            .attr('data-id', nodeData.id)
            .attr('data-type', nodeData.type)
            .attr('transform', `translate(${nodeData.x},${nodeData.y})`)
            .style('opacity', 0)
            .on('click', (event) => handleNodeClick(event, nodeData))
            .datum(nodeData);

        nodeGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 5)
            .attr('ry', 5);

        if (nodeData.isImage && nodeData.imageUrl) {
            const padding = LAYOUT.CONTENT_TEXT_PADDING || 5;
            nodeGroup.append('image')
                .attr('href', nodeData.imageUrl)
                .attr('x', padding)
                .attr('y', padding)
                .attr('width', nodeWidth - (padding * 2))
                .attr('height', nodeHeight - (padding * 2));
        } else {
        const textElement = nodeGroup.append('text')
            .style('font-size', nodeData.fontSize || '10px')
            .style('font-weight', nodeData.fontWeight || '400');

        if (nodeData.type === 'content') {
            textElement
                .attr('x', 0)
                .attr('y', 0)
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'hanging');
            
            wrapMarkdownText(
                textElement, 
                nodeData.label, 
                nodeWidth, 
                LAYOUT.CONTENT_TEXT_PADDING, 
                LAYOUT.LINE_HEIGHT_EM,
                nodeData.fontSize
            );

        } else {
            const plainText = markdownToPlainText(nodeData.label);
            textElement
                .attr('x', nodeWidth / 2)
                .attr('y', nodeHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .text(plainText);
            }
        }

        nodeGroup.transition()
            .duration(config.ANIMATION.NODE_FADE_IN || 400)
            .ease(d3.easeQuadOut)
            .style('opacity', 1)
            .on('end', () => resolve(nodeGroup));
    });
}

// Replace the existing wrapText function with this markdown-aware version
function wrapMarkdownText(textElement, markdownText, width, padding, lineHeightEm, fontSize) {
    textElement.selectAll("tspan").remove();

    // Apply the font size to the parent text element
    if (fontSize) {
        textElement.style('font-size', fontSize);
    }

    // Parse markdown into styled segments
    const styledSegments = parseMarkdownForSVG(markdownText);
    
    let allLines = []; // Store all lines instead of just current line
    let currentLine = [];
    const x = padding;
    
    // Create first tspan with proper font size for measurement only
    let currentTspan = textElement.append("tspan")
        .attr("x", x)
        .attr("dy", `${padding}px`);
    
    if (fontSize) {
        currentTspan.style('font-size', fontSize);
    }

    for (const segment of styledSegments) {
        const words = segment.text.split(/\s+/).filter(word => word.length > 0);
        
        for (const word of words) {
            // Test if adding this word would exceed width
            const testText = currentLine.length > 0 ? 
                currentLine.map(s => s.text).join(" ") + " " + word :
                word;
            
            currentTspan.text(testText);
            
            if (currentTspan.node().getComputedTextLength() > (width - (padding * 2)) && currentLine.length > 0) {
                // Line is too long, save current line and start new one
                allLines.push([...currentLine]); // Save complete line
                currentLine = [{ ...segment, text: word }];
                
                // Update measurement tspan for new line
                currentTspan.text(word);
            } else {
                // Add word to current line
                if (currentLine.length === 0) {
                    currentLine.push({ ...segment, text: word });
                } else {
                    const lastSegment = currentLine[currentLine.length - 1];
                    if (lastSegment.bold === segment.bold && 
                        lastSegment.italic === segment.italic && 
                        lastSegment.code === segment.code) {
                        lastSegment.text += " " + word;
                    } else {
                        currentLine.push({ ...segment, text: " " + word });
                    }
                }
            }
        }
    }
    
    // Add the final line
    if (currentLine.length > 0) {
        allLines.push(currentLine);
    }
    
    // Remove measurement tspan
    textElement.selectAll("tspan").remove();
    
    // Render all lines
    renderAllLines(textElement, allLines, x, padding, lineHeightEm, fontSize);
}

// New function to render all lines properly
function renderAllLines(textElement, allLines, x, padding, lineHeightEm, fontSize) {
    for (let lineIndex = 0; lineIndex < allLines.length; lineIndex++) {
        const line = allLines[lineIndex];
        
        for (let segmentIndex = 0; segmentIndex < line.length; segmentIndex++) {
            const segment = line[segmentIndex];
            const tspan = textElement.append("tspan");
            
            // Position for first segment of each line
            if (segmentIndex === 0) {
                tspan.attr("x", x);
                if (lineIndex === 0) {
                    tspan.attr("dy", `${padding}px`); // First line starts with padding
                } else {
                    tspan.attr("dy", `${lineHeightEm}em`); // Subsequent lines use line height
                }
            }
            
            // Apply base font size
            if (fontSize) {
                tspan.style('font-size', fontSize);
            }
            
            // Apply styling
            if (segment.bold) tspan.style("font-weight", "bold");
            if (segment.italic) tspan.style("font-style", "italic");
            if (segment.code) {
                tspan.style("font-family", "monospace");
            }
            
            tspan.text(segment.text);
        }
    }
}

// Helper functions for markdown rendering
function parseMarkdownForSVG(text) {
    const segments = [];
    let currentIndex = 0;
    
    // Simple regex patterns for common markdown
    const patterns = [
        { regex: /\*\*(.*?)\*\*/g, style: { bold: true } },
        { regex: /\*(.*?)\*/g, style: { italic: true } },
        { regex: /`(.*?)`/g, style: { code: true } }
    ];
    
    while (currentIndex < text.length) {
        let nearestMatch = null;
        let nearestPattern = null;
        
        // Find the nearest markdown pattern
        for (const pattern of patterns) {
            pattern.regex.lastIndex = currentIndex;
            const match = pattern.regex.exec(text);
            if (match && (!nearestMatch || match.index < nearestMatch.index)) {
                nearestMatch = match;
                nearestPattern = pattern;
            }
        }
        
        if (nearestMatch) {
            // Add plain text before the match
            if (nearestMatch.index > currentIndex) {
                const plainText = text.slice(currentIndex, nearestMatch.index);
                segments.push({ text: plainText, bold: false, italic: false, code: false });
            }
            
            // Add styled text
            segments.push({ 
                text: nearestMatch[1], 
                ...nearestPattern.style,
                bold: nearestPattern.style.bold || false,
                italic: nearestPattern.style.italic || false,
                code: nearestPattern.style.code || false
            });
            
            currentIndex = nearestMatch.index + nearestMatch[0].length;
        } else {
            // No more matches, add remaining text
            const remainingText = text.slice(currentIndex);
            if (remainingText) {
                segments.push({ text: remainingText, bold: false, italic: false, code: false });
            }
            break;
        }
    }
    
    return segments;
}

function markdownToPlainText(markdownText) {
    return markdownText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#+\s*/gm, '')
        .replace(/^\s*[-*+]\s*/gm, '')
        .trim();
}

/**
 * Creates a connector dot for leaf nodes (No longer used in the new layout)
 * @param {Object} dotData - Position and parent info for the dot
 * @returns {Object} D3 selection of the created dot
 */
/* // Commenting out createConnectorDot as it's not used with the new layout
export function createConnectorDot(dotData) {
    const g = mindMapState.getGroup();
    
    const dot = g.append('circle')
        .attr('class', 'connector-dot')
        .attr('data-parent', dotData.parentId)
        .attr('cx', dotData.x)
        .attr('cy', dotData.y)
        .attr('r', config.CONNECTOR_DOT.RADIUS)
        .attr('fill', '#666')
        .attr('stroke', '#444')
        .attr('stroke-width', 1);

    return dot;
}
*/

/**
 * Creates a connection path between two nodes
 * @param {TreeNode} sourceNode - The source TreeNode object.
 * @param {TreeNode} targetNode - The target TreeNode object.
 * @returns {Object|null} D3 selection of the created path, or null if no path is drawn.
 */
export function createConnection(sourceNode, targetNode) {
    if (!sourceNode || !targetNode) {
        console.warn('CreateConnection called with invalid source or target node.');
        return null;
    }
    const g = mindMapState.getGroup();
    
    // generateOrthogonalPath now takes sourceNode and targetNode directly
    const pathDataResult = generateOrthogonalPath(sourceNode, targetNode);
    
    if (!pathDataResult || !pathDataResult.path || pathDataResult.path === "") {
        // PathGenerator might return an empty path for certain connections (e.g., header to content)
        return null; 
    }
    
    const path = g.insert('path', '.node') // Insert paths behind nodes
        .attr('class', 'link') // General class 'link'. Specific styling can use CSS selectors with node types.
        .attr('data-source', sourceNode.id)
        .attr('data-target', targetNode.id)
        .attr('d', pathDataResult.path);
        
    return path;
}