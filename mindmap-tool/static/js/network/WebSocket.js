import { mindMapState } from '../config/state.js';
import { addNodeWithAnimation } from '../components/Animation.js';
import { handleNodeClick } from '../utils/EventHandlers.js';
import TreeLayout from '../layout/TreeLayout.js';

/**
 * Establishes WebSocket connection for a mindmap
 * @param {string} mindmapId - ID of the mindmap
 */
export function connectWebSocket(mindmapId) {
    if (!mindmapId) {
        console.log("No mindmap ID provided, skipping WebSocket connection");
        return;
    }

    if (mindMapState.getWebSocket()) {
        mindMapState.getWebSocket().close();
    }
    
    mindMapState.addToMessageQueue({});
    mindMapState.setProcessingState(false);
    
    const port = window.location.port || '8001';
    const ws = new WebSocket(`ws://${window.location.hostname}:${port}/ws/${mindmapId}`);
    
    ws.onopen = () => {
        console.log("WebSocket connection established for mindmap:", mindmapId);
    };

    ws.onmessage = (event) => {
        const parsedData = JSON.parse(event.data);
        handleWebSocketMessage(parsedData);
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed for mindmap:", mindmapId);
    };

    mindMapState.setWebSocket(ws);
}

/**
 * Handles incoming WebSocket messages
 * @param {Object} data - Message data
 */
async function handleWebSocketMessage(data) {
    if (data.type === 'node_created') {
        const nodeData = data.data;
        const g = mindMapState.getGroup();
        const currentNodes = g.selectAll('.node').data();
        
        // Add new node to current nodes
        currentNodes.push({
            id: nodeData.id,
            label: nodeData.content,
            parent_id: nodeData.parent_id
        });

        // Calculate new layout
        const layout = new TreeLayout();
        const root = layout.buildTree(currentNodes);
        const layoutNodes = await layout.calculateLayout(root);

        // Clear and redraw with animation
        g.selectAll('*').remove();

        // Add nodes sequentially
        for (const node of layoutNodes) {
            if (!node.isFake) {
                const nodeData = {
                    ...currentNodes.find(n => n.id === node.id),
                    x: node.x,
                    y: node.y,
                    isLeaf: node.isLeaf
                };

                if (node.parentId) {
                    const parent = layoutNodes.find(n => n.id === node.parentId);
                    const connectToDot = parent.children.some(child => 
                        child.isFake && child.children.includes(node));

                    if (connectToDot) {
                        const dot = layoutNodes.find(n => 
                            n.isFake && n.parentId === node.parentId);
                        nodeData.connectToDot = true;
                        nodeData.dotX = dot.x;
                        nodeData.dotY = dot.y;
                    } else {
                        nodeData.parentX = parent.x;
                        nodeData.parentY = parent.y;
                    }
                }

                await addNodeWithAnimation(nodeData, handleNodeClick);
                await new Promise(resolve => 
                    setTimeout(resolve, config.ANIMATION.TRANSITION_DELAY));
            }
        }
    } else if (data.type === 'node_deleted') {
        // Handle node deletion
        const g = mindMapState.getGroup();
        g.selectAll(`g[data-id="${data.data.node_id}"]`).remove();
        g.selectAll(`.link[data-target="${data.data.node_id}"]`).remove();
        
        // Recalculate layout for remaining nodes
        const currentNodes = g.selectAll('.node').data();
        const layout = new TreeLayout();
        const root = layout.buildTree(currentNodes);
        if (root) {
            await layout.calculateLayout(root);
        }
    }
} 