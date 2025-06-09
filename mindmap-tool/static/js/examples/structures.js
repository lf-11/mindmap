import { structureDefinitions } from './structureDefinitions.js';

// Simple format to define structures
// Use indentation to indicate hierarchy
// Each line format: "name: content"

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

function parseTextStructure(text) {
    return parseStructure(text);
}

function parseJsonStructure(json) {
    console.log("Starting parseJsonStructure with:", json);
    
    const rootNode = {
        content: "Table of Contents",
        key: "root",
        children: []
    };

    if (json.table_of_contents && Array.isArray(json.table_of_contents)) {
        console.log("Found table_of_contents array with length:", json.table_of_contents.length);
        rootNode.children = json.table_of_contents.map(node => {
            const converted = convertNode(node);
            console.log("Converted node:", converted);
            return converted;
        });
    } else {
        console.warn("No table_of_contents array found in JSON:", json);
    }

    console.log("Final rootNode structure:", rootNode);
    return rootNode;

    function convertNode(node) {
        console.log("Converting node:", node);
        const converted = {
            content: node.title,
            key: node.title.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            page: node.page,
            children: (node.children || []).map(child => {
                console.log("Converting child node:", child);
                return convertNode(child);
            })
        };
        return converted;
    }
}

export function getAvailableStructures() {
    return [...Object.keys(structureDefinitions), "JSON"];
}

export async function getStructure(name) {
    if (name === "JSON") {
        try {
            console.log("Fetching JSON structure");
            const response = await fetch('/static/js/examples/tableOfContents.json');
            const jsonData = await response.json();
            console.log("Fetched JSON data:", jsonData);
            const structure = parseJsonStructure(jsonData);
            console.log("Parsed structure:", structure);
            return structure;
        } catch (error) {
            console.error("Error loading JSON structure:", error);
            throw new Error('Failed to load JSON structure: ' + error.message);
        }
    }

    const definition = structureDefinitions[name];
    if (!definition) {
        throw new Error(`Structure "${name}" not found`);
    }
    return parseStructure(definition);
} 