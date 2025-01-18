class MindMapState {
    constructor() {
        this.svg = null;
        this.g = null;
        this.currentMindmapId = null;
        this.selectedNodeId = null;
        this.selectedNodeLabel = null;
        this.ws = null;
        this.treeLayout = null;
        this.width = null;
        this.height = null;
        this.currentTransform = null;
        this.messageQueue = [];
        this.isProcessingMessage = false;
    }

    // Getters
    getSvg() { return this.svg; }
    getGroup() { return this.g; }
    getCurrentMindmapId() { return this.currentMindmapId; }
    getSelectedNodeId() { return this.selectedNodeId; }
    getWebSocket() { return this.ws; }
    getTreeLayout() { return this.treeLayout; }
    getDimensions() { return { width: this.width, height: this.height }; }
    getCurrentTransform() { return this.currentTransform; }
    
    // Setters
    setSvg(svg) { this.svg = svg; }
    setGroup(g) { this.g = g; }
    setCurrentMindmapId(id) { this.currentMindmapId = id; }
    setSelectedNode(id, label) {
        this.selectedNodeId = id;
        this.selectedNodeLabel = label;
    }
    setWebSocket(ws) { this.ws = ws; }
    setTreeLayout(layout) { this.treeLayout = layout; }
    setDimensions(width, height) {
        this.width = width;
        this.height = height;
    }
    setCurrentTransform(transform) { this.currentTransform = transform; }

    // Message queue methods
    addToMessageQueue(message) {
        this.messageQueue.push(message);
    }
    
    getNextMessage() {
        return this.messageQueue.shift();
    }
    
    hasMessages() {
        return this.messageQueue.length > 0;
    }
    
    setProcessingState(isProcessing) {
        this.isProcessingMessage = isProcessing;
    }
    
    isProcessing() {
        return this.isProcessingMessage;
    }

    // Clear state
    clear() {
        this.messageQueue = [];
        this.isProcessingMessage = false;
        this.selectedNodeId = null;
        this.selectedNodeLabel = null;
    }
}

// Create and export a singleton instance
export const mindMapState = new MindMapState(); 