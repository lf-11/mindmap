import { mindMapState } from '../config/state.js';
import { createNodeGroup } from '../components/Node.js';
import { handleNodeClick } from '../utils/EventHandlers.js';
import { connectWebSocket } from '../network/WebSocket.js';
import { getStructure } from './structures.js';

class MindmapBuilder {
    constructor() {
        this.currentMindmapId = null;
        this.nodeMap = new Map();
        this.rootNodeCreated = false;
    }

    async createStructure(title, structure) {
        console.log("Creating structure with:", { title, structure });
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
        
        // Clear existing visualization
        mindMapState.getGroup().selectAll('*').remove();
        
        // Connect WebSocket and wait for connection
        console.log("4. Connecting WebSocket");
        connectWebSocket(mindmap.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Add logging before creating root node
        console.log("Creating root node with content:", structure.content);
        const rootResponse = await fetch(
            `/mindmaps/${this.currentMindmapId}/root?content=${encodeURIComponent(structure.content)}`,
            { method: 'POST' }
        );
        const rootNode = await rootResponse.json();
        console.log("Root node created:", rootNode);
        this.nodeMap.set('root', rootNode.id);

        // Create root node visualization
        const rootNodeData = {
            id: rootNode.id,
            x: 0,
            y: 0,
            label: structure.content,
            parent_id: null
        };

        createNodeGroup(rootNodeData, handleNodeClick);
        this.rootNodeCreated = true;

        // Wait to ensure root node is stable
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add logging for children
        if (structure.children) {
            console.log("Found children to add:", structure.children.length);
            for (const child of structure.children) {
                console.log("Adding child:", child);
                await this.addChildWithDelay('root', child);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            console.log("No children found in structure");
        }

        return this.currentMindmapId;
    }

    async addChildWithDelay(parentKey, nodeStructure) {
        console.log("Adding child with delay:", { parentKey, nodeStructure });
        if (!this.rootNodeCreated) {
            console.error('Root node not yet created');
            return;
        }

        const parentId = this.nodeMap.get(parentKey);
        if (!parentId) {
            console.error(`Parent node ${parentKey} not found`);
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Get the content from either content or title property
        const nodeContent = nodeStructure.content || nodeStructure.title;
        console.log("Sending request to create node with content:", nodeContent);

        try {
            const response = await fetch(`/mindmaps/${this.currentMindmapId}/nodes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: nodeContent,
                    parent_id: parentId
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to create node:', errorText);
                throw new Error(`Failed to create node: ${response.status} ${errorText}`);
            }

            const newNode = await response.json();
            console.log("Node created successfully:", newNode);
            
            const nodeKey = nodeStructure.key || `node_${newNode.id}`;
            this.nodeMap.set(nodeKey, newNode.id);

            console.log("Waiting for node to appear in DOM...");
            await new Promise(resolve => {
                let attempts = 0;
                const checkNode = setInterval(() => {
                    attempts++;
                    const nodeExists = mindMapState.getGroup().select(`g[data-id="${newNode.id}"]`).size() > 0;
                    console.log(`Check attempt ${attempts}: Node exists = ${nodeExists}`);
                    
                    if (nodeExists || attempts > 50) { // Add maximum attempts
                        clearInterval(checkNode);
                        resolve();
                    }
                }, 100);
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            if (nodeStructure.children && nodeStructure.children.length > 0) {
                console.log(`Processing ${nodeStructure.children.length} children for node ${nodeKey}`);
                for (const child of nodeStructure.children) {
                    await this.addChildWithDelay(nodeKey, child);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return newNode;
        } catch (error) {
            console.error('Error in addChildWithDelay:', error);
            throw error;
        }
    }
}

export async function buildStructure(structureName) {
    try {
        const structure = await getStructure(structureName);
        const builder = new MindmapBuilder();
        await builder.createStructure(structureName, structure);
        console.log(`${structureName} built successfully`);
    } catch (error) {
        console.error(`Error building ${structureName}:`, error);
        throw error;
    }
} 