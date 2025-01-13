class MindmapBuilder {
    constructor() {
        this.currentMindmapId = null;
        this.nodeMap = new Map();
        this.rootNodeCreated = false;
    }

    async createStructure(title, structure) {
        console.log("1. Starting createStructure");
        // Create mindmap
        const mindmapResponse = await fetch('/mindmaps/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const mindmap = await mindmapResponse.json();
        this.currentMindmapId = mindmap.id;
        console.log("2. Mindmap created with ID:", mindmap.id);

        // Update UI and connect WebSocket
        document.getElementById('currentMindmap').innerHTML = `Current Mindmap: ${title} (ID: ${mindmap.id})`;
        
        // Clear existing visualization and reinitialize
        g.selectAll('*').remove();
        
        // Initialize network if not already done
        if (!svg) {
            console.log("3. Initializing network");
            initNetwork();
        }
        
        // Connect WebSocket and wait for connection
        console.log("4. Connecting WebSocket");
        connectWebSocket(mindmap.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("5. WebSocket connection wait complete");

        // Create root node directly instead of waiting for WebSocket
        console.log("6. Creating root node:", structure.content);
        const rootResponse = await fetch(
            `/mindmaps/${this.currentMindmapId}/root?content=${encodeURIComponent(structure.content)}`,
            { method: 'POST' }
        );
        const rootNode = await rootResponse.json();
        console.log("7. Root node response:", rootNode);
        this.nodeMap.set('root', rootNode.id);

        // Create root node in DOM immediately
        const rootNodeData = {
            id: rootNode.id,
            x: 0,
            y: 0,
            label: structure.content,
            parent_id: null
        };

        // Create root node visualization
        const nodeGroup = g.append('g')
            .attr('class', 'node')
            .attr('data-id', rootNode.id)
            .attr('transform', `translate(${width/2},60)`)
            .on('click', handleNodeClick)
            .datum(rootNodeData);

        nodeGroup.append('rect')
            .attr('x', -nodeWidth/2)
            .attr('y', -nodeHeight/2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 5);

        nodeGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .text(rootNodeData.label);

        this.rootNodeCreated = true;
        console.log("9. Root node created in DOM");

        // Wait to ensure root node is stable
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("10. Root node stabilized");

        // Build the tree recursively with delays
        if (structure.children) {
            console.log("11. Starting to add children");
            for (const child of structure.children) {
                console.log("12. Adding child:", child.content);
                await this.addChildWithDelay('root', child);
                console.log("13. Child added:", child.content);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log("14. Structure creation complete");
        return this.currentMindmapId;
    }

    async addChildWithDelay(parentKey, nodeStructure) {
        // Ensure root node exists before adding children
        if (!this.rootNodeCreated) {
            console.error('Root node not yet created');
            return;
        }

        const parentId = this.nodeMap.get(parentKey);
        if (!parentId) {
            console.error(`Parent node ${parentKey} not found`);
            return;
        }

        // Wait before creating node
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create the child node
        const response = await fetch(`/mindmaps/${this.currentMindmapId}/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: nodeStructure.content,
                parent_id: parentId
            })
        });
        const newNode = await response.json();
        
        // Store node ID and wait for it to appear in the DOM
        const nodeKey = nodeStructure.key || `node_${newNode.id}`;
        this.nodeMap.set(nodeKey, newNode.id);

        await new Promise(resolve => {
            const checkNode = setInterval(() => {
                const nodeElement = d3.select(`g[data-id="${newNode.id}"]`);
                if (!nodeElement.empty()) {
                    clearInterval(checkNode);
                    resolve();
                }
            }, 100);
        });

        // Wait after node creation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add children recursively
        if (nodeStructure.children) {
            for (const child of nodeStructure.children) {
                await this.addChildWithDelay(nodeKey, child);
                // Wait between siblings
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return newNode;
    }
}

// Example usage:
async function buildExampleMindmap() {
    console.log("Starting to build example mindmap...");
    try {
        if (!svg || !g) {
            console.log("Initializing network...");
            initNetwork();
        }
        
        const builder = new MindmapBuilder();
        
        const structure = {
            content: "Root Topic",
            key: "root",
            children: [
                {
                    content: "Branch 1",
                    key: "b1",
                    children: [
                        { content: "Sub-topic 1.1" },
                        { content: "Sub-topic 1.2" },
                        { 
                            content: "Sub-topic 1.3",
                            key: "b1_3",
                            children: [
                                { content: "Detail 1.3.1" },
                                { content: "Detail 1.3.2" }
                            ]
                        }
                    ]
                },
                {
                    content: "Branch 2",
                    key: "b2",
                    children: [
                        { content: "Sub-topic 2.1" },
                        { content: "Sub-topic 2.2" }
                    ]
                },
                {
                    content: "Branch 3",
                    children: [
                        { content: "Sub-topic 3.1" },
                        { content: "Sub-topic 3.2" },
                        { content: "Sub-topic 3.3" }
                    ]
                }
            ]
        };

        console.log("Creating structure...");
        await builder.createStructure("Example Mindmap", structure);
        console.log("Mindmap built successfully");
    } catch (error) {
        console.error("Error building mindmap:", error);
    }
}

// More example structures:
async function buildProjectMindmap() {
    const builder = new MindmapBuilder();
    
    const structure = {
        content: "Project Planning",
        key: "root",
        children: [
            {
                content: "Requirements",
                children: [
                    { content: "User Stories" },
                    { content: "Technical Specs" },
                    { content: "Design Guidelines" }
                ]
            },
            {
                content: "Timeline",
                children: [
                    { content: "Phase 1" },
                    { content: "Phase 2" },
                    { content: "Phase 3" }
                ]
            },
            {
                content: "Resources",
                children: [
                    { content: "Team Members" },
                    { content: "Budget" },
                    { content: "Tools" }
                ]
            }
        ]
    };

    await builder.createStructure("Project Planning", structure);
}

// Add this to your HTML:
// <button onclick="buildExampleMindmap()">Build Example Mindmap</button>
// <button onclick="buildProjectMindmap()">Build Project Mindmap</button> 

console.log("mindmap_builder.js loaded");

// Make the functions globally available
window.buildExampleMindmap = buildExampleMindmap;
window.buildProjectMindmap = buildProjectMindmap; 