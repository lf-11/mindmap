import { mindMapState } from '../config/state.js';
import { addNodeWithAnimation } from '../components/Animation.js';
import { handleNodeClick } from '../utils/EventHandlers.js';

/**
 * Establishes WebSocket connection for a mindmap
 * @param {string} mindmapId - ID of the mindmap
 */
export function connectWebSocket(mindmapId) {
    if (mindMapState.getWebSocket()) {
        mindMapState.getWebSocket().close();
    }
    
    mindMapState.addToMessageQueue({});
    mindMapState.setProcessingState(false);
    
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/${mindmapId}`);
    
    ws.onopen = () => console.log("WebSocket connection established");
    ws.onmessage = (event) => handleWebSocketMessage(JSON.parse(event.data));
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket connection closed");

    mindMapState.setWebSocket(ws);
}

/**
 * Handles incoming WebSocket messages
 * @param {Object} data - Message data
 */
async function handleWebSocketMessage(data) {
    console.log("Processing WebSocket message:", data);
    mindMapState.addToMessageQueue(data);
    
    if (!mindMapState.isProcessing()) {
        console.log("Starting to process message queue");
        await processMessageQueue();
    } else {
        console.log("Already processing messages, added to queue");
    }
}

/**
 * Processes queued WebSocket messages sequentially
 */
async function processMessageQueue() {
    mindMapState.setProcessingState(true);
    const g = mindMapState.getGroup();
    
    while (mindMapState.hasMessages()) {
        const data = mindMapState.getNextMessage();
        console.log("Processing message:", data);
        
        if (data.type === 'node_created') {
            const nodeData = data.data;
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
                
                await addNodeWithAnimation(parentNode, childNode, handleNodeClick);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                // Handle root node creation
                const rootNode = {
                    id: nodeData.id,
                    x: 0,
                    y: 0,
                    label: nodeData.content,
                    parent_id: null
                };
                
                g.selectAll('*').remove();
                
                if (mindMapState.getCurrentTransform()) {
                    g.attr('transform', mindMapState.getCurrentTransform());
                }
                
                createRootNode(rootNode);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else if (data.type === 'node_deleted') {
            g.selectAll(`g[data-id="${data.data.node_id}"]`).remove();
            g.selectAll(`.link[data-target="${data.data.node_id}"]`).remove();
            updateLayout();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    mindMapState.setProcessingState(false);
} 