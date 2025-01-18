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
        
        // Clear existing visualization
        mindMapState.getGroup().selectAll('*').remove();
        
        // Connect WebSocket and wait for connection
        console.log("4. Connecting WebSocket");
        connectWebSocket(mindmap.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create root node
        console.log("6. Creating root node:", structure.content);
        const rootResponse = await fetch(
            `/mindmaps/${this.currentMindmapId}/root?content=${encodeURIComponent(structure.content)}`,
            { method: 'POST' }
        );
        const rootNode = await rootResponse.json();
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

        // Build the tree recursively with delays
        if (structure.children) {
            for (const child of structure.children) {
                await this.addChildWithDelay('root', child);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return this.currentMindmapId;
    }

    async addChildWithDelay(parentKey, nodeStructure) {
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

        const response = await fetch(`/mindmaps/${this.currentMindmapId}/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: nodeStructure.content,
                parent_id: parentId
            })
        });
        const newNode = await response.json();
        
        const nodeKey = nodeStructure.key || `node_${newNode.id}`;
        this.nodeMap.set(nodeKey, newNode.id);

        await new Promise(resolve => {
            const checkNode = setInterval(() => {
                if (mindMapState.getGroup().select(`g[data-id="${newNode.id}"]`).size() > 0) {
                    clearInterval(checkNode);
                    resolve();
                }
            }, 100);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        if (nodeStructure.children) {
            for (const child of nodeStructure.children) {
                await this.addChildWithDelay(nodeKey, child);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return newNode;
    }
}

export async function buildStructure(structureName) {
    try {
        const structure = getStructure(structureName);
        const builder = new MindmapBuilder();
        await builder.createStructure(structureName, structure);
        console.log(`${structureName} built successfully`);
    } catch (error) {
        console.error(`Error building ${structureName}:`, error);
    }
} 