import TreeNode from '../models/TreeNode.js';
import { LAYOUT, NODE_WIDTH, NODE_HEIGHT, IMAGE_SETTINGS } from '../config/config.js';
import { mindMapState } from '../config/state.js';

// Add these helper functions at the top
function isLeaf(node) {
    return !node.children || node.children.length === 0;
}

function countLeafSiblingsBefore(node) {
    if (!node.parent) return 0;
    const siblings = node.parent.children;
    const nodeIndex = siblings.indexOf(node);
    return siblings
        .slice(0, nodeIndex)
        .filter(sibling => isLeaf(sibling))
        .length;
}

// First, add these constants at the top with the imports

/**
 * Calculates the dimensions of a subtree rooted at the given node
 * @param {Object} node - The root node of the subtree
 * @returns {Object} Dimensions including width and extents
 */
export function calculateSubtreeDimensions(node) {
    if (isLeaf(node)) {
        return {
            width: config.NODE_WIDTH,
            leftExtent: config.NODE_WIDTH/2,
            rightExtent: config.NODE_WIDTH/2,
            center: 0,
            isLeaf: true
        };
    }

    // Calculate dimensions for all children
    const childrenDimensions = node.children.map(calculateSubtreeDimensions);
    
    // Separate leaf and non-leaf children
    const leafChildren = childrenDimensions.filter(dim => dim.isLeaf);
    const nonLeafChildren = childrenDimensions.filter(dim => !dim.isLeaf);

    // Calculate width needed for non-leaf children
    let totalNonLeafWidth = 0;
    nonLeafChildren.forEach((dim, i) => {
        totalNonLeafWidth += dim.width;
        if (i < nonLeafChildren.length - 1) {
            totalNonLeafWidth += config.MIN_NODE_SEPARATION;
        }
    });

    // For leaf children, we only need the width of one node since they're stacked
    const leafWidth = leafChildren.length > 0 ? config.NODE_WIDTH * 0.5 : 0;

    // Total width is max of non-leaf children total width and single leaf width
    const totalWidth = Math.max(
        totalNonLeafWidth,
        leafWidth,
        config.NODE_WIDTH // minimum width of the node itself
    );

    return {
        width: totalWidth,
        leftExtent: Math.max(config.NODE_WIDTH/2, totalWidth/2),
        rightExtent: Math.max(config.NODE_WIDTH/2, totalWidth/2),
        center: totalWidth/2,
        childrenDimensions: childrenDimensions,
        isLeaf: false
    };
}

// Helper functions for node type checking
function getLeafGroups(node) {
    if (!node.children) return [];
    
    // Group consecutive leaf nodes together
    const groups = [];
    let currentGroup = [];
    
    node.children.forEach(child => {
        if (isLeaf(child)) {
            currentGroup.push(child);
        } else {
            if (currentGroup.length > 0) {
                groups.push([...currentGroup]);
                currentGroup = [];
            }
        }
    });
    
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    
    return groups;
}

// Add this helper function to determine if all children are leaves
function allChildrenAreLeaves(node) {
    return node.children && node.children.length > 0 && 
           node.children.every(child => isLeaf(child));
}

function shouldStackLeaves(parent) {
    if (!parent.children) return false;
    const leafNodes = parent.children.filter(child => isLeaf(child));
    const totalNodes = parent.children.length;
    
    // Stack if there are more than 3 total nodes AND at least 2 leaf nodes
    return totalNodes > 3 && leafNodes.length >= 2;
}

function calculateNodeSize(node) {
    if (isLeaf(node)) {
        return {
            width: config.NODE_WIDTH,
            height: config.NODE_HEIGHT
        };
    }

    const leafNodes = node.children.filter(child => isLeaf(child));
    const nonLeafNodes = node.children.filter(child => !isLeaf(child));
    const shouldStack = shouldStackLeaves(node);

    let totalWidth;
    if (shouldStack) {
        // When stacking leaves, only count width for non-leaf nodes
        totalWidth = nonLeafNodes.length * (config.NODE_WIDTH + config.MIN_NODE_SEPARATION * 2);
    } else {
        // When not stacking, count width for all nodes
        totalWidth = node.children.length * config.NODE_WIDTH + 
                    (node.children.length - 1) * config.MIN_NODE_SEPARATION;
    }

    return {
        width: Math.max(config.NODE_WIDTH, totalWidth),
        height: config.NODE_HEIGHT,
        shouldStack: shouldStack,
        leafCount: leafNodes.length,
        nonLeafCount: nonLeafNodes.length
    };
}

// Add this function to analyze the tree structure
function analyzeTreeStructure(treeData) {
    const levelAnalysis = new Map();
    
    // First analyze the complete tree structure
    treeData.eachBefore(node => {
        const level = node.depth;
        if (!levelAnalysis.has(level)) {
            levelAnalysis.set(level, {
                parentToChildren: new Map(),
                totalWidth: 0
            });
        }
        
        const levelInfo = levelAnalysis.get(level);
        const parent = node.parent;
        
        if (parent) {
            const parentId = parent.data.id;
            if (!levelInfo.parentToChildren.has(parentId)) {
                levelInfo.parentToChildren.set(parentId, {
                    leaves: [],
                    nonLeaves: [],
                    parent: parent,
                    totalWidth: 0,
                    xStart: 0,
                    stackedLeaves: false
                });
            }
            const parentGroup = levelInfo.parentToChildren.get(parentId);
            
            if (isLeaf(node)) {
                parentGroup.leaves.push(node);
            } else {
                parentGroup.nonLeaves.push(node);
            }
        }
    });

    // Second pass: Calculate widths and stacking decisions
    levelAnalysis.forEach((levelInfo, level) => {
        levelInfo.parentToChildren.forEach(parentGroup => {
            const totalNodes = parentGroup.leaves.length + parentGroup.nonLeaves.length;
            const leafCount = parentGroup.leaves.length;
            
            // Determine if we should stack leaves for this parent
            parentGroup.stackedLeaves = totalNodes > 4 && leafCount >= 2;

            if (parentGroup.stackedLeaves) {
                // Width for non-leaves + space for stacked leaves
                parentGroup.totalWidth = parentGroup.nonLeaves.length * 
                    (config.NODE_WIDTH + config.MIN_NODE_SEPARATION) +
                    config.MIN_LEAF_PARENT_SPACING;
            } else {
                // Standard horizontal layout
                parentGroup.totalWidth = totalNodes * config.NODE_WIDTH +
                    (totalNodes - 1) * config.MIN_NODE_SEPARATION;
            }

            levelInfo.totalWidth += parentGroup.totalWidth + config.MIN_SUBTREE_SEPARATION;
        });
    });
    
    return levelAnalysis;
}

function analyzeLevel(parent) {
    if (!parent.children) return null;
    
    const children = parent.children;
    const leafNodes = children.filter(child => isLeaf(child));
    const nonLeafNodes = children.filter(child => !isLeaf(child));
    
    return {
        totalNodes: children.length,
        leafNodes: leafNodes,
        nonLeafNodes: nonLeafNodes,
        shouldStack: children.length > 4 && leafNodes.length >= 2
    };
}

function calculateLeafPositions(parentPos, leaves) {
    const dotPos = {
        x: parentPos.x + config.CONNECTOR_DOT.OFFSET_X,
        y: parentPos.y + config.CONNECTOR_DOT.OFFSET_Y
    };

    return {
        dotPos,
        leafPositions: leaves.map((leaf, index) => ({
            nodeId: leaf.data.id,
            position: {
                x: parentPos.x + config.LEAF_NODE.HORIZONTAL_OFFSET,
                y: dotPos.y + config.LEAF_NODE.VERTICAL_SPACING * (index + 1)
            }
        }))
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
    
    const nodesWithNew = [...currentNodes, tempNode];
    const hierarchy = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parent_id)(nodesWithNew);

    const positions = new Map();
    const levelAnalysis = analyzeTreeStructure(hierarchy);

    // First pass: Calculate parent group positions
    levelAnalysis.forEach((levelInfo, level) => {
        let currentX = -levelInfo.totalWidth / 2; // Center the entire level
        
        levelInfo.parentToChildren.forEach(parentGroup => {
            parentGroup.xStart = currentX;
            currentX += parentGroup.totalWidth + config.MIN_SUBTREE_SEPARATION;
        });
    });

    // Second pass: Position nodes based on complete analysis
    hierarchy.eachBefore(node => {
        const level = node.depth;
        const parent = node.parent;

        if (!parent) {
            positions.set(node.data.id, {
                x: 0,
                y: level * config.BASE_VERTICAL_SPACING,
                isLeaf: false
            });
            return;
        }

        const parentPos = positions.get(parent.data.id);
        const levelInfo = levelAnalysis.get(level);
        const parentGroup = levelInfo.parentToChildren.get(parent.data.id);

        if (!parentGroup) {
            console.error('Missing parent group for', parent.data.id);
            return;
        }

        if (isLeaf(node)) {
            const leafCount = parentGroup.leaves.length;
            
            if (leafCount >= config.LEAF_NODE.MIN_COUNT_FOR_DOT) {
                // Calculate positions for all leaves of this parent
                if (!positions.has('dot-' + parent.data.id)) {
                    const { dotPos, leafPositions } = calculateLeafPositions(parentPos, parentGroup.leaves);
                    
                    // Store dot position
                    positions.set('dot-' + parent.data.id, {
                        x: dotPos.x,
                        y: dotPos.y,
                        isDot: true,
                        parentId: parent.data.id
                    });
                    
                    // Store all leaf positions
                    leafPositions.forEach(({ nodeId, position }) => {
                        positions.set(nodeId, {
                            ...position,
                            isLeaf: true,
                            parentId: parent.data.id,
                            connectFromDot: true
                        });
                    });
                }
            } else {
                // Handle single leaf without dot
                positions.set(node.data.id, {
                    x: parentPos.x + config.LEAF_NODE.HORIZONTAL_OFFSET,
                    y: parentPos.y + config.BASE_VERTICAL_SPACING,
                    isLeaf: true,
                    parentId: parent.data.id,
                    connectFromDot: false
                });
            }
        } else {
            // Position non-leaf nodes horizontally
            const index = parentGroup.nonLeaves.indexOf(node);
            const xOffset = parentGroup.xStart + 
                          (index * (config.NODE_WIDTH + config.MIN_NODE_SEPARATION));
            
            positions.set(node.data.id, {
                x: xOffset + config.NODE_WIDTH/2,
                y: level * config.BASE_VERTICAL_SPACING,
                isLeaf: false
            });
        }
    });

    return positions;
}

class TreeLayout {
    constructor() {
        this.nodeMap = new Map();
    }

    buildTree(nodesData) {
        this.nodeMap.clear();
        const rootNodes = [];

        // First pass: create TreeNode instances and map them
        nodesData.forEach(nodeData => {
            const treeNode = new TreeNode(nodeData.id, nodeData.label, nodeData.parent_id);
            treeNode.type = nodeData.type || 'default';
            
            if (nodeData.type === 'content') {
                const imageMatch = nodeData.label.match(/\!\[\]\((.*?)\)/);
                if (imageMatch) {
                    treeNode.isImage = true;
                    treeNode.imagePath = imageMatch[1].trim().replace(/^\./, '');
                }
            }
            
            // Call _setNodeInitialDimensions AFTER tree structure is known,
            // as it might depend on parent type/size for content nodes.
            // For now, only basic type is set. Dimensions will be set in calculateLayout.
            // this._setNodeInitialDimensions(treeNode); 

            this.nodeMap.set(nodeData.id, treeNode);
        });

        // Second pass: build parent-child relationships
        this.nodeMap.forEach(node => {
            if (node.parentId && this.nodeMap.has(node.parentId)) {
                const parentNode = this.nodeMap.get(node.parentId);
                parentNode.children.push(node);
                node.isRoot = false;
            } else {
                node.isRoot = true;
                rootNodes.push(node);
            }
        });
        
        // Final pass: determine leaf status after children are assigned
        this.nodeMap.forEach(node => {
            node.isLeaf = node.children.length === 0;
        });

        if (rootNodes.length > 1) {
            console.warn("Multiple root nodes found. The PDF layout expects a single document title as root.", rootNodes);
        }
        return rootNodes.length > 0 ? rootNodes[0] : null;
    }

    async calculateLayout(rootNode) {
        if (!rootNode) return [];

        const imageNodes = [];
        this.nodeMap.forEach(node => {
            if (node.isImage) {
                imageNodes.push(node);
            }
        });

        if (imageNodes.length > 0) {
            const imagePromises = imageNodes.map(node => this._loadImageDimensions(node));
            await Promise.all(imagePromises);
        }
        
        const allNodesWithPositions = [];
        
        const positionNodeRecursive = (node, currentXForNodeContext, currentY, level, parentNode) => {
            node.level = level;
            
            // ENSURE PARENT IS FULLY DIMENSIONED FIRST
            if (parentNode && (!parentNode.width || !parentNode.height)) {
                this._setNodeInitialDimensions(parentNode, null); // Force parent sizing first
            }
            
            this._setNodeInitialDimensions(node, parentNode); 
            node.junctionPoints = {}; 

            const parentExitPointX = parentNode ? parentNode.x + LAYOUT.VERTICAL_TRUNK_NODE_OFFSET : 0;

            if (node.type === 'title') {
                node.x = LAYOUT.INITIAL_X_OFFSET;
                node.y = LAYOUT.INITIAL_Y_OFFSET;
            } else if (node.type.startsWith('header')) {
                node.x = currentXForNodeContext + LAYOUT.HEADER_HORIZONTAL_OFFSET;
                if (parentNode && parentNode.type.startsWith('header')) {
                    node.x = currentXForNodeContext + LAYOUT.SUB_HEADER_HORIZONTAL_OFFSET; 
                }
                node.y = currentY;
            } else if (node.type === 'content') {
                node.x = parentExitPointX + LAYOUT.CONTENT_INDENTATION;
                node.y = currentY;
            } else { 
                node.x = currentXForNodeContext; 
                node.y = currentY;
            }
            
            allNodesWithPositions.push(node);
            let nextYForSibling = node.y + node.height;

            if (node.type.startsWith('header') || node.type === 'title') {
                const allContentChildren = node.children.filter(c => this.nodeMap.get(c.id)?.type === 'content');
                const subHeaderChildren = node.children.filter(c => {
                    const childNode = this.nodeMap.get(c.id);
                    return childNode && childNode.type.startsWith('header');
                });
                
                if (allContentChildren.length > 0) {
                    let groupMaxWidth = 0; // Renamed for clarity
                    const contentNodeFont = {
                        fontSize: '10px', fontWeight: '400', fontFamily: "'IBM Plex Mono', Consolas, monospace"
                    };
                    const defaultNodeHeight = NODE_HEIGHT;
                    const { MIN_NODE_WIDTH, CONTENT_MAX_HEIGHT_MULTIPLIER, CONTENT_MAX_WIDTH_MULTIPLIER, CONTENT_WIDTH_INCREMENT, TEXT_PADDING_HORIZONTAL, CONTENT_TEXT_PADDING } = LAYOUT;

                    // Pass 1: Determine the maximum width required by any node in the group to meet height constraints
                    allContentChildren.forEach(contentNode => {
                        let bestWidthForThisNode = MIN_NODE_WIDTH;

                        if (contentNode.isImage) {
                            // For images, their 'best' width is their pre-loaded width.
                            bestWidthForThisNode = contentNode.width || MIN_NODE_WIDTH;
                        } else {
                            // For text nodes, calculate their optimal wrapping width.
                        const plainTextLabel = this._markdownToPlainText(contentNode.label);
                        const maxAllowedHeight = node.height * CONTENT_MAX_HEIGHT_MULTIPLIER;
                        const maxWidth = NODE_WIDTH * CONTENT_MAX_WIDTH_MULTIPLIER;
                        const minWidth = Math.max(MIN_NODE_WIDTH, NODE_WIDTH * 0.8);
                        
                        let bestHeight = Infinity;
                        let testWidth = minWidth;

                        while (testWidth <= maxWidth) {
                            const calculatedHeight = this._calculateWrappedHeight(
                                plainTextLabel, testWidth, contentNodeFont.fontFamily, contentNodeFont.fontSize, contentNodeFont.fontWeight, defaultNodeHeight
                            );

                            if (calculatedHeight <= maxAllowedHeight) {
                                bestWidthForThisNode = testWidth;
                                break; 
                            } else if (calculatedHeight < bestHeight) {
                                bestWidthForThisNode = testWidth;
                                bestHeight = calculatedHeight;
                            }
                            testWidth += CONTENT_WIDTH_INCREMENT;
                            }
                        }
                        
                        if (bestWidthForThisNode > groupMaxWidth) {
                            groupMaxWidth = bestWidthForThisNode;
                        }
                    });

                    // Pass 2: Set final dimensions for each node based on the group's max width
                    allContentChildren.forEach(contentNode => {
                        if (contentNode.isImage) {
                            const imageNodeOriginalPaddedWidth = contentNode.width;
                            // Constrain the image width by the group's max width
                            const finalPaddedWidth = Math.min(imageNodeOriginalPaddedWidth, groupMaxWidth);

                            if (finalPaddedWidth < imageNodeOriginalPaddedWidth) {
                                // Rescale height to maintain aspect ratio if width was reduced
                                const padding = CONTENT_TEXT_PADDING * 2;
                                const finalImageWidth = finalPaddedWidth - padding;
                                
                                // Safeguard: Ensure aspectRatio is a valid number before using it.
                                if (typeof contentNode.aspectRatio !== 'number' || isNaN(contentNode.aspectRatio)) {
                                    console.error("Image node has invalid aspectRatio. Using 1.", contentNode);
                                    contentNode.aspectRatio = 1;
                                }

                                const finalImageHeight = finalImageWidth * contentNode.aspectRatio;

                                contentNode.width = finalPaddedWidth;
                                contentNode.height = finalImageHeight + padding;
                            }
                            // Else, if image is smaller than groupMaxWidth, it keeps its original size.

                        } else {
                            // This logic is for text nodes
                        const plainTextLabel = this._markdownToPlainText(contentNode.label);
                        
                        const tempText = mindMapState.getGroup().append('text')
                            .attr('class', 'temp-text-measure')
                            .style('font-family', contentNodeFont.fontFamily)
                            .style('font-size', contentNodeFont.fontSize)
                            .style('font-weight', contentNodeFont.fontWeight)
                            .text(plainTextLabel);
                        const textMetrics = tempText.node().getBBox();
                        tempText.remove();
                        
                        const singleLineWidth = Math.max(MIN_NODE_WIDTH, textMetrics.width + (TEXT_PADDING_HORIZONTAL * 2));

                        // If the node's single-line text fits, use that width. Otherwise, use the group's max width and wrap.
                        if (singleLineWidth <= groupMaxWidth) {
                            contentNode.width = singleLineWidth;
                        } else {
                            contentNode.width = groupMaxWidth;
                        }
                        
                        contentNode.height = this._calculateWrappedHeight(
                            plainTextLabel, contentNode.width, contentNodeFont.fontFamily, contentNodeFont.fontSize, contentNodeFont.fontWeight, defaultNodeHeight
                        );
                        }
                        
                        // Safeguard: After all sizing logic, ensure height is a valid number.
                        if (typeof contentNode.height !== 'number' || isNaN(contentNode.height)) {
                            console.error("Node height was NaN. Falling back to default height.", contentNode);
                            contentNode.height = defaultNodeHeight;
                        }
                        
                        contentNode.markdownLabel = contentNode.label;
                        contentNode.plainTextLabel = this._markdownToPlainText(contentNode.label);
                        contentNode.fontSize = contentNodeFont.fontSize;
                    });
                }
                
                let yCommonStartForChildren = node.y + node.height + LAYOUT.CONTENT_TOP_MARGIN;
                const effectiveParentExitX = node.x + LAYOUT.VERTICAL_TRUNK_NODE_OFFSET;
                node.junctionPoints.parentExitX = effectiveParentExitX;

                // Handle special case where parent has both content and sub-headers
                if (subHeaderChildren.length > 0 && allContentChildren.length > 0) {
                    node.junctionPoints.subHeaderBusY = yCommonStartForChildren + LAYOUT.SUB_HEADER_BUS_HEIGHT / 2;
                    let maxContentRightEdge = node.x;
                    allContentChildren.forEach(ccNode => {
                        const childActual = this.nodeMap.get(ccNode.id);
                        const contentNodeX = effectiveParentExitX + LAYOUT.CONTENT_INDENTATION;
                        maxContentRightEdge = Math.max(maxContentRightEdge, contentNodeX + childActual.width);
                    });
                    node.junctionPoints.subHeaderTrunkX = maxContentRightEdge + LAYOUT.SUB_HEADER_BUS_RIGHT_MARGIN;
                    yCommonStartForChildren += LAYOUT.SUB_HEADER_BUS_HEIGHT;
                }

                // PROCESS CONTENT NODES
                let yOffsetForContent = yCommonStartForChildren;
                allContentChildren.forEach((childTreeNode, index) => {
                    const childActualNode = this.nodeMap.get(childTreeNode.id);
                    if (index > 0) yOffsetForContent += LAYOUT.CONTENT_VERTICAL_SPACING;
                    yOffsetForContent = positionNodeRecursive(childActualNode, node.x, yOffsetForContent, level + 1, node);
                });
                const finalYAfterContent = allContentChildren.length > 0 ? yOffsetForContent : (node.y + node.height);

                // PROCESS SUB-HEADERS
                let yOffsetForSubHeaders = yCommonStartForChildren;
                if (node.junctionPoints.subHeaderBusY && allContentChildren.length > 0) {
                     yOffsetForSubHeaders = node.junctionPoints.subHeaderBusY + LAYOUT.SUB_HEADER_BUS_HEIGHT / 2;
                }

                subHeaderChildren.forEach((childTreeNode, index) => {
                    const childActualNode = this.nodeMap.get(childTreeNode.id);
                    if (index > 0) yOffsetForSubHeaders += LAYOUT.HEADER_VERTICAL_SPACING;
                    
                    let trunkXForThisSubHeader = effectiveParentExitX;
                    if (node.junctionPoints.subHeaderTrunkX) { 
                        trunkXForThisSubHeader = node.junctionPoints.subHeaderTrunkX;
                    }
                    yOffsetForSubHeaders = positionNodeRecursive(childActualNode, trunkXForThisSubHeader, yOffsetForSubHeaders, level + 1, node);
                });
                const finalYAfterSubHeaders = subHeaderChildren.length > 0 ? yOffsetForSubHeaders : (node.y + node.height);
                
                nextYForSibling = Math.max(finalYAfterContent, finalYAfterSubHeaders, node.y + node.height);
            }
            return nextYForSibling; 
        };
        positionNodeRecursive(rootNode, LAYOUT.INITIAL_X_OFFSET, LAYOUT.INITIAL_Y_OFFSET, 0, null);
        return allNodesWithPositions;
    }

    async _loadImageDimensions(node) {
        return new Promise((resolve) => {
            const imageUrl = `${IMAGE_SETTINGS.BASE_URL}/${node.imagePath}`;

            const img = new Image();
            img.onload = () => {
                let width = img.naturalWidth;
                let height = img.naturalHeight;
                
                // Safeguard: Prevent division by zero and handle invalid image dimensions.
                if (width > 0) {
                    node.aspectRatio = height / width;
                } else {
                    console.warn("Image loaded with zero width, using fallback dimensions.", node.imagePath);
                    node.aspectRatio = 1; 
                    width = IMAGE_SETTINGS.ERROR_NODE_WIDTH; 
                    height = IMAGE_SETTINGS.ERROR_NODE_HEIGHT;
                }

                const maxWidth = IMAGE_SETTINGS.MAX_WIDTH;
                const maxHeight = IMAGE_SETTINGS.MAX_HEIGHT;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }
                
                const padding = LAYOUT.CONTENT_TEXT_PADDING || 5;

                node.width = width + (padding * 2);
                node.height = height + (padding * 2);
                node.imageUrl = imageUrl;
                resolve();
            };
            img.onerror = () => {
                console.error("Could not load image:", imageUrl);
                node.label = `Image not found: ${node.imagePath}`;
                node.isImage = false; // Revert to a text node
                node.width = IMAGE_SETTINGS.ERROR_NODE_WIDTH;
                node.height = IMAGE_SETTINGS.ERROR_NODE_HEIGHT;
                resolve();
            };
            img.src = imageUrl;
        });
    }

    _calculateWrappedHeight(plainText, width, fontFamily, fontSize, fontWeight, defaultNodeHeight) {
        const {
            TEXT_PADDING_HORIZONTAL, TEXT_PADDING_VERTICAL, LINE_HEIGHT_EM
        } = LAYOUT;

        const words = plainText.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) {
            return defaultNodeHeight;
        }

        let lineCount = 1;
        let currentLine = '';

        const svgForMeasure = mindMapState.getSvg() || d3.select(document.body).append("svg").style("visibility", "hidden").attr("class", "temp-svg-measure");
        const textElementForWrapping = svgForMeasure.append('text')
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight);

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            textElementForWrapping.text(testLine);
            if (textElementForWrapping.node().getComputedTextLength() > (width - (TEXT_PADDING_HORIZONTAL * 2))) {
                lineCount++;
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        textElementForWrapping.remove();
        if (svgForMeasure !== mindMapState.getSvg()) svgForMeasure.remove();

        const tempChar = mindMapState.getGroup().append('text')
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight)
            .text('M');
        const singleLineActualHeight = tempChar.node().getBBox().height;
        tempChar.remove();

        let calculatedTextBlockHeight;
        if (lineCount <= 1) {
            calculatedTextBlockHeight = singleLineActualHeight;
        } else {
            calculatedTextBlockHeight = ((lineCount - 1) * singleLineActualHeight * LINE_HEIGHT_EM) + singleLineActualHeight;
        }
        
        return Math.max(
            defaultNodeHeight,
            // Add top padding (used by renderer) and a smaller 5px bottom padding for a tighter fit.
            calculatedTextBlockHeight + TEXT_PADDING_VERTICAL + 5
        );
    }

    _setNodeInitialDimensions(node, parentNode = null) {
        if (node.isImage) {
            return;
        }
        
        if (node.type === 'content' && node.width && node.height) {
            if (!node.fontSize) node.fontSize = '10px'; // Fallback
            return;
        }

        const {
            TEXT_PADDING_HORIZONTAL, TEXT_PADDING_VERTICAL,
            MIN_NODE_WIDTH, LINE_HEIGHT_EM
        } = LAYOUT;
        const defaultNodeHeight = NODE_HEIGHT;

        if (!mindMapState.getGroup()) {
            node.width = node.width || NODE_WIDTH;
            node.height = node.height || defaultNodeHeight;
            return;
        }

        // Convert markdown to plain text for dimension calculations
        const plainTextLabel = this._markdownToPlainText(node.label);

        // SIMPLIFIED FONT SIZING - EXACT SIZES AS REQUESTED
        let fontSize = '10px';
        let fontWeight = '400';
        let fontFamily = "'IBM Plex Mono', Consolas, monospace";

        if (node.type === 'title') {
            fontSize = '16px';
            fontWeight = '700';
        } else if (node.type === 'header_l1') {
            fontSize = '16px';
            fontWeight = '700';
        } else if (node.type === 'header_l2') {
            fontSize = '14px';
            fontWeight = '700';
        } else if (node.type.startsWith('header')) {
            fontSize = '12px';
            fontWeight = '700';
        } else if (node.type === 'content') {
            fontSize = '10px';
            fontWeight = '400';
        }

        const tempText = mindMapState.getGroup().append('text')
            .attr('class', 'temp-text-measure') 
            .style('font-family', fontFamily)
            .style('font-size', fontSize) 
            .style('font-weight', fontWeight)
            .text(plainTextLabel);
        
        let textMetrics;

        if (node.type === 'title' || node.type.startsWith('header')) {
            textMetrics = tempText.node().getBBox();
            node.width = Math.max(MIN_NODE_WIDTH, textMetrics.width + (TEXT_PADDING_HORIZONTAL * 2));
            node.height = Math.max(defaultNodeHeight, textMetrics.height + (TEXT_PADDING_VERTICAL * 2));
        } else if (node.type === 'content') {
            let finalHeight = defaultNodeHeight;
            
            if (parentNode) {
                const maxAllowedHeight = parentNode.height * LAYOUT.CONTENT_MAX_HEIGHT_MULTIPLIER;
                const maxWidth = NODE_WIDTH * LAYOUT.CONTENT_MAX_WIDTH_MULTIPLIER;
                const minWidth = Math.max(MIN_NODE_WIDTH, NODE_WIDTH * 0.8);
                
                let testWidth = minWidth;
                let bestWidth = minWidth;
                let bestHeight = Infinity;
                
                tempText.remove();
                
                while (testWidth <= maxWidth) {
                    const calculatedHeight = this._calculateWrappedHeight(
                        plainTextLabel, testWidth, fontFamily, fontSize, fontWeight, defaultNodeHeight
                    );

                    if (calculatedHeight <= maxAllowedHeight) {
                        bestWidth = testWidth;
                        bestHeight = calculatedHeight;
                        break; 
                    } else if (calculatedHeight < bestHeight) {
                        bestWidth = testWidth;
                        bestHeight = calculatedHeight;
                    }

                    testWidth += LAYOUT.CONTENT_WIDTH_INCREMENT;
                }

                node.width = bestWidth;
                finalHeight = bestHeight;
                
            } else {
                node.width = NODE_WIDTH;
                finalHeight = this._calculateWrappedHeight(
                    plainTextLabel, node.width, fontFamily, fontSize, fontWeight, defaultNodeHeight
                );
            }

            node.height = finalHeight;
            node.markdownLabel = node.label;
            node.plainTextLabel = plainTextLabel;
            node.fontSize = fontSize;
            node.fontWeight = fontWeight;

        } else {
            textMetrics = tempText.node().getBBox();
            node.width = Math.max(MIN_NODE_WIDTH, textMetrics.width + (TEXT_PADDING_HORIZONTAL * 2));
            node.height = defaultNodeHeight;
        }
        
        // FORCE the fontSize for ALL node types
        node.fontSize = fontSize;
        node.fontWeight = fontWeight;
        
        if (tempText && !tempText.empty()) tempText.remove();
    }

    _markdownToPlainText(markdownText) {
        // Simple markdown to plain text conversion for dimension calculations
        return markdownText
            .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
            .replace(/\*(.*?)\*/g, '$1')      // Remove italic
            .replace(/`(.*?)`/g, '$1')        // Remove inline code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links, keep text
            .replace(/^#+\s*/gm, '')          // Remove headers
            .replace(/^\s*[-*+]\s*/gm, '')    // Remove list markers
            .trim();
    }
}

export default TreeLayout; 