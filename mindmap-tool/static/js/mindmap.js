let svg, g;
let currentMindmapId = null;
let selectedNodeId = null;
let ws = null;
let selectedNodeLabel = null;
let treeLayout;
let width, height;
const nodeWidth = 100;
const nodeHeight = 30;
const baseVerticalSpacing = 100;
const baseHorizontalSpacing = 200;
let currentTransform = null;
let messageQueue = [];
let isProcessingMessage = false;

// Add these constants for configuration
const MIN_NODE_SEPARATION = nodeWidth * 1.2; // Minimum space between sibling nodes
const MIN_SUBTREE_SEPARATION = nodeWidth * 1.5; // Minimum space between different subtrees

// Initialize the visualization
function initNetwork() {
    const container = document.getElementById('mindmap');
    width = container.clientWidth;
    height = container.clientHeight;

    svg = d3.select('#mindmap')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Set initial transform
    currentTransform = d3.zoomIdentity.translate(width/2, 60).scale(1);

    g = svg.append('g')
        .attr('transform', currentTransform);

    // Initialize tree layout with modified separation logic
    treeLayout = d3.tree()
        .nodeSize([nodeWidth * 2, baseVerticalSpacing])
        .separation((a, b) => {
            const aWidth = calculateSubtreeDimensions(a).width;
            const bWidth = calculateSubtreeDimensions(b).width;
            
            // If nodes share the same parent, use minimum separation
            if (a.parent === b.parent) {
                return MIN_NODE_SEPARATION / nodeWidth;
            }
            
            // For nodes in different subtrees, ensure enough space for both subtrees
            return (aWidth + bWidth) / (2 * nodeWidth) + MIN_SUBTREE_SEPARATION / nodeWidth;
        });

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            currentTransform = event.transform;
            g.attr('transform', currentTransform);
        });

    svg.call(zoom);
    // Set initial transform using zoom
    svg.call(zoom.transform, currentTransform);
}

function generateOrthogonalPath(source, target) {
    const midY = (source.y + target.y) / 2;
    
    // Create the path differently based on whether target is left or right of source
    if (target.x < source.x) {
        // For nodes to the left, ensure path starts at source
        // Use absolute values to ensure correct path length
        const verticalLength1 = Math.abs(midY - source.y);
        const horizontalLength = Math.abs(target.x - source.x);
        const verticalLength2 = Math.abs(target.y - midY);
        
        return {
            path: `M ${source.x} ${source.y}
                   V ${midY}
                   H ${target.x}
                   V ${target.y}`,
            length: verticalLength1 + horizontalLength + verticalLength2
        };
    } else {
        // For nodes to the right
        const verticalLength1 = Math.abs(midY - source.y);
        const horizontalLength = Math.abs(target.x - source.x);
        const verticalLength2 = Math.abs(target.y - midY);
        
        return {
            path: `M ${source.x} ${source.y}
                   V ${midY}
                   H ${target.x}
                   V ${target.y}`,
            length: verticalLength1 + horizontalLength + verticalLength2
        };
    }
}

// Helper function to calculate subtree dimensions
function calculateSubtreeDimensions(node) {
    if (!node.children || node.children.length === 0) {
        return {
            width: nodeWidth,
            leftExtent: nodeWidth/2,
            rightExtent: nodeWidth/2,
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
            totalChildrenWidth += MIN_NODE_SEPARATION;
        }
    });

    // Calculate the center position relative to leftmost child
    const center = totalChildrenWidth / 2;

    return {
        width: Math.max(nodeWidth, totalChildrenWidth),
        leftExtent: Math.max(nodeWidth/2, center),
        rightExtent: Math.max(nodeWidth/2, center),
        center: center,
        childrenDimensions: childrenDimensions
    };
}

// Update calculateNewLayout to use subtree dimensions
function calculateNewLayout(newNodeParentId, tempId) {
    const currentNodes = g.selectAll('.node').data();
    
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
    
    // Calculate initial tree layout
    const treeData = treeLayout(hierarchy);
    const rootX = treeData.x;
    
    // Calculate all subtree dimensions
    const dimensions = calculateSubtreeDimensions(treeData);
    
    // Convert to map of positions with proper spacing
    const positions = new Map();
    treeData.descendants().forEach(d => {
        if (d.parent) {
            const parentDim = calculateSubtreeDimensions(d.parent);
            const siblings = d.parent.children;
            const siblingIndex = siblings.indexOf(d);
            
            // Calculate cumulative width of previous siblings and their spacing
            let previousWidth = 0;
            for (let i = 0; i < siblingIndex; i++) {
                const sibDim = calculateSubtreeDimensions(siblings[i]);
                previousWidth += sibDim.width + MIN_NODE_SEPARATION;
            }
            
            // Position node considering its subtree's center
            const nodeDim = calculateSubtreeDimensions(d);
            const xOffset = previousWidth + nodeDim.center - parentDim.center;
            
            positions.set(d.data.id, {
                x: (d.parent.x - rootX) + xOffset,
                y: d.y
            });
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

// Update addNodeWithAnimation function to ensure paths use final positions
function addNodeWithAnimation(parentNode, childNode) {
    console.log('Adding node with animation:', {parent: parentNode, child: childNode});
    
    childNode.parent_id = parentNode.id;

    const tempId = 'temp_' + Date.now();
    const newPositions = calculateNewLayout(parentNode.id, tempId);
    console.log('New positions:', newPositions);

    // First Phase: Move existing nodes and their connections SIMULTANEOUSLY
    const moveExistingNodes = new Promise(resolve => {
        const transitions = [];

        // Update existing nodes positions
        g.selectAll('.node').each(function(d) {
            const newPos = newPositions.get(d.id);
            if (newPos) {
                const node = d3.select(this);
                const nodeTransition = node.transition()
                    .duration(500)
                    .ease(d3.easeQuadInOut)
                    .attr('transform', `translate(${newPos.x},${newPos.y})`);
                
                transitions.push(nodeTransition);

                // Update associated link with new parent position
                const link = g.select(`.link[data-target="${d.id}"]`);
                if (!link.empty()) {
                    const parentPos = newPositions.get(d.parent_id);
                    if (parentPos) {
                        const newPathData = generateOrthogonalPath(
                            parentPos,
                            newPos
                        );
                        
                        const linkTransition = link.transition()
                            .duration(500)
                            .ease(d3.easeQuadInOut)
                            .attr('d', newPathData.path);
                        
                        transitions.push(linkTransition);
                    }
                }
            }
        });

        Promise.all(transitions).then(resolve);
    });

    // Second Phase: Add new node and animate its connection
    moveExistingNodes.then(() => {
        setTimeout(() => {
            const newNodePos = newPositions.get(tempId);
            const parentPos = newPositions.get(parentNode.id);
            
            if (!newNodePos || !parentPos) {
                console.error('Failed to get positions');
                return;
            }

            // Create new node at final position
            const nodeGroup = g.append('g')
                .attr('class', 'node')
                .attr('data-id', childNode.id)
                .attr('transform', `translate(${newNodePos.x},${newNodePos.y})`)
                .on('click', handleNodeClick)
                .datum(childNode);

            nodeGroup.append('rect')
                .attr('x', -nodeWidth/2)
                .attr('y', -nodeHeight/2)
                .attr('width', nodeWidth)
                .attr('height', nodeHeight)
                .attr('rx', 5);

            nodeGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .text(childNode.label);

            // Create and animate the new link using final positions
            const pathData = generateOrthogonalPath(
                parentPos,
                newNodePos
            );

            const link = g.insert('path', '.node')
                .attr('class', 'link')
                .attr('data-target', childNode.id)
                .attr('d', pathData.path)
                .style('opacity', 1);

            const totalLength = pathData.length; // Use calculated length instead of getTotalLength()

            link
                .style('stroke-dasharray', totalLength)
                .style('stroke-dashoffset', totalLength)
                .transition()
                .duration(1000)
                .ease(d3.easeLinear)
                .style('stroke-dashoffset', 0)
                .on('end', function() {
                    d3.select(this)
                        .style('stroke-dasharray', null)
                        .style('stroke-dashoffset', null);
                });
        }, 500);
    });
}

// Create WebSocket connection
function connectWebSocket(mindmapId) {
    if (ws) {
        ws.close();
    }
    // Clear message queue when connecting new WebSocket
    messageQueue = [];
    isProcessingMessage = false;
    
    ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/${mindmapId}`);
    
    ws.onopen = function() {
        console.log("WebSocket connection established");
    };
    
    ws.onmessage = function(event) {
        console.log("WebSocket message received:", event.data);
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = function(error) {
        console.error("WebSocket error:", error);
    };

    ws.onclose = function() {
        console.log("WebSocket connection closed");
    };
}

// Update the WebSocket message handler
async function handleWebSocketMessage(data) {
    console.log("Processing WebSocket message:", data);
    // Add message to queue
    messageQueue.push(data);
    
    // If not already processing messages, start processing
    if (!isProcessingMessage) {
        console.log("Starting to process message queue");
        await processMessageQueue();
    } else {
        console.log("Already processing messages, added to queue");
    }
}

// Add new function to process messages sequentially
async function processMessageQueue() {
    isProcessingMessage = true;
    console.log("Processing message queue, length:", messageQueue.length);
    
    while (messageQueue.length > 0) {
        const data = messageQueue.shift();
        console.log("Processing message:", data);
        
        if (data.type === 'node_created') {
            const nodeData = data.data;
            console.log("Processing node creation:", nodeData);
            const parentElement = d3.select(`g[data-id="${nodeData.parent_id}"]`);
            
            if (!parentElement.empty()) {
                const parentNode = parentElement.datum();
                
                const childNode = {
                    id: nodeData.id,
                    x: 0,
                    y: 0,
                    label: nodeData.content,
                    parent_id: nodeData.parent_id
                };
                
                await new Promise(resolve => {
                    addNodeWithAnimation(parentNode, childNode);
                    // Wait for animation to complete
                    setTimeout(resolve, 1000);
                });
            } else {
                // Root node handling
                console.log("Creating root node in DOM:", nodeData);
                const rootNode = {
                    id: nodeData.id,
                    x: 0,
                    y: 0,
                    label: nodeData.content,
                    parent_id: null
                };
                
                // Clear any existing content
                g.selectAll('*').remove();

                // Use the current transform
                if (currentTransform) {
                    g.attr('transform', currentTransform);
                }
                
                // Get container dimensions if not set
                if (!width || !height) {
                    const container = document.getElementById('mindmap');
                    width = container.clientWidth;
                    height = container.clientHeight;
                }
                
                const nodeGroup = g.append('g')
                    .attr('class', 'node')
                    .attr('data-id', rootNode.id)
                    .attr('transform', `translate(${width/2},60)`)
                    .on('click', handleNodeClick)
                    .datum(rootNode);

                nodeGroup.append('rect')
                    .attr('x', -nodeWidth/2)
                    .attr('y', -nodeHeight/2)
                    .attr('width', nodeWidth)
                    .attr('height', nodeHeight)
                    .attr('rx', 5);

                nodeGroup.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.3em')
                    .text(rootNode.label);
                
                console.log("Root node created in DOM");
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else if (data.type === 'node_deleted') {
            g.selectAll(`g[data-id="${data.data.node_id}"]`).remove();
            g.selectAll(`.link[data-target="${data.data.node_id}"]`).remove();
            updateLayout();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    isProcessingMessage = false;
}

async function createMindmap() {
    const title = document.getElementById('mindmapTitle').value;
    if (!title) return;

    const response = await fetch('/mindmaps/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
    });

    const mindmap = await response.json();
    currentMindmapId = mindmap.id;
    document.getElementById('currentMindmap').innerHTML = `Current Mindmap: ${title} (ID: ${mindmap.id})`;
    
    // Clear existing visualization
    g.selectAll('*').remove();
    
    // Connect WebSocket
    connectWebSocket(mindmap.id);
}

async function createRootNode() {
    if (!currentMindmapId) return;
    const content = document.getElementById('rootContent').value;
    if (!content) return;

    const response = await fetch(`/mindmaps/${currentMindmapId}/root?content=${encodeURIComponent(content)}`, {
        method: 'POST'
    });

    const node = await response.json();
    const rootNode = {
        id: node.id,
        x: 0,
        y: 60,  // Initial vertical offset
        label: node.content,
        parent_id: null
    };

    // Clear any existing content
    g.selectAll('*').remove();

    // Don't reset the transform, use the current one
    if (currentTransform) {
        g.attr('transform', currentTransform);
    }

    const nodeGroup = g.append('g')
        .attr('class', 'node')
        .attr('data-id', rootNode.id)
        .attr('transform', 'translate(0,0)')  // Position relative to transformed group
        .on('click', handleNodeClick)
        .datum(rootNode);

    nodeGroup.append('rect')
        .attr('x', -nodeWidth/2)
        .attr('y', -nodeHeight/2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 5);

    nodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .text(rootNode.label);

    // Clear the input field
    document.getElementById('rootContent').value = '';
}

async function addChildNode() {
    if (!currentMindmapId) {
        alert('Please create a mindmap first');
        return;
    }
    if (!selectedNodeId) {
        alert('Please select a parent node first');
        return;
    }
    
    const content = document.getElementById('nodeContent').value;
    if (!content) {
        alert('Please enter node content');
        return;
    }

    const response = await fetch(`/mindmaps/${currentMindmapId}/nodes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content,
            parent_id: selectedNodeId
        })
    });

    // Clear the input field
    document.getElementById('nodeContent').value = '';
}

async function loadMindmapStructure(mindmapId) {
    const response = await fetch(`/mindmaps/${mindmapId}/structure`);
    const structure = await response.json();
    
    // Clear existing visualization
    g.selectAll('*').remove();
    
    function addNodeToVisualization(nodeData, parentData = null) {
        const node = {
            id: nodeData.id,
            x: nodeData.x_pos,
            y: nodeData.y_pos,
            label: nodeData.content
        };

        if (parentData) {
            addNodeWithAnimation(parentData, node);
        } else {
            // Add root node
            const nodeGroup = g.append('g')
                .attr('class', 'node')
                .attr('data-id', node.id)
                .attr('transform', `translate(${node.x},${node.y})`)
                .on('click', handleNodeClick)
                .datum(node);

            nodeGroup.append('rect')
                .attr('x', -50)
                .attr('y', -15)
                .attr('width', 100)
                .attr('height', 30)
                .attr('rx', 5);

            nodeGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .text(node.label);
        }

        // Recursively add children
        for (const child of nodeData.children) {
            addNodeToVisualization(child, node);
        }
    }
    
    addNodeToVisualization(structure);
}

// Add node click handler
function handleNodeClick(event, d) {
    event.stopPropagation();
    
    // Remove previous selection
    g.selectAll('.node').classed('selected', false);
    
    // Update selection
    const nodeGroup = d3.select(this);
    nodeGroup.classed('selected', true);
    
    selectedNodeId = d.id;
    selectedNodeLabel = d.label;
    document.getElementById('nodeContent').placeholder = `Add child to: ${selectedNodeLabel}`;

    // Preserve current transform
    if (currentTransform) {
        g.attr('transform', currentTransform);
    }
}

// Add this function to update the tree layout
function updateLayout() {
    // Create hierarchy from current nodes
    const nodes = g.selectAll('.node').data();
    if (nodes.length === 0) return;

    // Find root node
    const rootNode = nodes.find(n => !n.parent_id);
    if (!rootNode) return;

    // Create hierarchy
    const hierarchy = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parent_id)(nodes);

    // Apply tree layout while maintaining root at (0,0)
    const treeData = treeLayout(hierarchy);
    
    // Ensure root stays at (0,0)
    const rootX = treeData.x;
    const rootY = treeData.y;
    
    // Store current transform before updates
    const savedTransform = currentTransform;

    // Update positions relative to root
    treeData.descendants().forEach(d => {
        const node = g.select(`g[data-id="${d.data.id}"]`);
        const x = d.x - rootX;
        const y = d.y;
        
        node.transition()
            .duration(750)
            .attr('transform', `translate(${x},${y})`);

        // Update links
        if (d.parent) {
            const link = g.select(`.link[data-target="${d.data.id}"]`);
            const newPath = generateOrthogonalPath(
                {x: d.parent.x - rootX, y: d.parent.y},
                {x: x, y: y}
            );
            
            link
                .attr('d', newPath)
                .each(function() {
                    const actualLength = this.getTotalLength();
                    d3.select(this)
                        .style('stroke-dasharray', `${actualLength}`)
                        .style('stroke-dashoffset', 0);
                });
        }
    });

    // Restore transform after updates
    if (savedTransform) {
        g.attr('transform', savedTransform);
    }
}

// Initialize the network when the page loads
document.addEventListener('DOMContentLoaded', initNetwork); 