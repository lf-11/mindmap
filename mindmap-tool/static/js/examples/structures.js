// Simple format to define structures
// Use indentation to indicate hierarchy
// Each line format: "name: content"
const structureDefinitions = {
    "Example Mindmap": `
root: Root Topic
    b1: Branch 1
        l1.1: Layer 1.1
            l2.1: Layer 2.1
                l3.1: Layer 3.1
                l3.2: Layer 3.2
                l3.3: Layer 3.3
            l2.2: Layer 2.2
                l3.4: Layer 3.4
                l3.5: Layer 3.5
    b2: Branch 2
        l1.2: Layer 1.2
            l2.3: Layer 2.3
                l3.6: Layer 3.6
                l3.7: Layer 3.7`,

    "Project Planning": `
root: Project Management
    req: Requirements
        us: User Stories
        ts: Technical Specs
        dg: Design Guidelines
    time: Timeline
        p1: Phase 1
        p2: Phase 2
        p3: Phase 3
    res: Resources
        tm: Team Members
        bg: Budget
        tl: Tools`,

    "Simple Test": `
root: Test Root
    a: Node A
        a1: Node A1
        a2: Node A2
    b: Node B
        b1: Node B1
        b2: Node B2`
};

// Convert the simple text format to the required structure
function parseStructure(text) {
    const lines = text.trim().split('\n');
    const structure = {};
    const stack = [{ node: structure, indent: -1 }];
    
    lines.forEach(line => {
        const indent = line.search(/\S/);
        const [key, content] = line.trim().split(': ');
        
        const node = {
            content: content,
            key: key,
            children: []
        };

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        const parent = stack[stack.length - 1].node;
        if (!parent.content) {
            // This is the root
            Object.assign(parent, node);
        } else {
            parent.children.push(node);
        }
        
        stack.push({ node, indent });
    });

    return structure;
}

export function getAvailableStructures() {
    return Object.keys(structureDefinitions);
}

export function getStructure(name) {
    const definition = structureDefinitions[name];
    if (!definition) {
        throw new Error(`Structure "${name}" not found`);
    }
    return parseStructure(definition);
} 