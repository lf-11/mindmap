import { mindMapState } from '../config/state.js';
import { createNodeGroup } from '../components/Node.js';
import { handleNodeClick } from '../utils/EventHandlers.js';
import { connectWebSocket } from './WebSocket.js';

/**
 * Creates a new mindmap
 * @param {string} title - Title of the mindmap
 */
export async function createMindmap(title) {
    if (!title) return;

    const response = await fetch('/mindmaps/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
    });

    const mindmap = await response.json();
    mindMapState.setCurrentMindmapId(mindmap.id);
    document.getElementById('currentMindmap').innerHTML = 
        `Current Mindmap: ${title} (ID: ${mindmap.id})`;
    
    mindMapState.getGroup().selectAll('*').remove();
    connectWebSocket(mindmap.id);
}

/**
 * Creates a root node for the mindmap
 * @param {string} content - Content of the root node
 */
export async function createRootNode(content) {
    if (!mindMapState.getCurrentMindmapId() || !content) return;

    const response = await fetch(
        `/mindmaps/${mindMapState.getCurrentMindmapId()}/root?content=${encodeURIComponent(content)}`,
        { method: 'POST' }
    );

    const node = await response.json();
    const rootNode = {
        id: node.id,
        x: 0,
        y: 60,
        label: node.content,
        parent_id: null
    };

    mindMapState.getGroup().selectAll('*').remove();

    if (mindMapState.getCurrentTransform()) {
        mindMapState.getGroup().attr('transform', mindMapState.getCurrentTransform());
    }

    createNodeGroup(rootNode, handleNodeClick);
    document.getElementById('rootContent').value = '';
}

/**
 * Adds a child node to the selected node
 * @param {string} content - Content of the child node
 */
export async function addChildNode(content) {
    if (!mindMapState.getCurrentMindmapId()) {
        alert('Please create a mindmap first');
        return;
    }
    if (!mindMapState.getSelectedNodeId()) {
        alert('Please select a parent node first');
        return;
    }
    if (!content) {
        alert('Please enter node content');
        return;
    }

    await fetch(`/mindmaps/${mindMapState.getCurrentMindmapId()}/nodes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content,
            parent_id: mindMapState.getSelectedNodeId()
        })
    });

    document.getElementById('nodeContent').value = '';
}

/**
 * Loads the structure of an existing mindmap
 * @param {string} mindmapId - ID of the mindmap to load
 */
export async function loadMindmapStructure(mindmapId) {
    const response = await fetch(`/mindmaps/${mindmapId}/structure`);
    const structure = await response.json();
    
    mindMapState.getGroup().selectAll('*').remove();
    
    function addNodeToVisualization(nodeData, parentData = null) {
        const node = {
            id: nodeData.id,
            x: nodeData.x_pos,
            y: nodeData.y_pos,
            label: nodeData.content,
            parent_id: parentData ? parentData.id : null
        };

        createNodeGroup(node, handleNodeClick);

        for (const child of nodeData.children) {
            addNodeToVisualization(child, node);
        }
    }
    
    addNodeToVisualization(structure);
} 