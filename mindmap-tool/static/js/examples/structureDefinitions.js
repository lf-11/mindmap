export const structureDefinitions = {
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
        b2: Node B2`,

    "Table of Contents": {
        "table_of_contents": [
            {
                "title": "Kapitel 1: Einführung",
                "page": 1,
                "children": [
                    {
                        "title": "1.1 Übersicht",
                        "page": 2,
                        "children": [
                            {
                                "title": "1.1.1 Grundlegendes",
                                "page": 3
                            }
                        ]
                    }
                ]
            }
        ]
    }
}; 