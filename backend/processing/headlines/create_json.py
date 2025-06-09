import os
import json
import psycopg2

# Database configuration - should match your setup_database.py
DB_CONFIG = {
    "dbname": "pdf_reader",
    "user": "postgres",
    "password": "postgres",
    "host": "192.168.178.61",
    "port": "5432"
}

class JsonCreator:
    def __init__(self, doc_id=1, doc_title="Test title"):
        self.doc_id = doc_id
        self.doc_title = doc_title
        self.nodes = []
        self.node_counter = 1
        self.current_parents = {}  # layer_number -> node_id
        
    def generate_node_id(self, prefix="node"):
        """Generate a unique node ID"""
        node_id = f"{prefix}_{self.node_counter}"
        self.node_counter += 1
        return node_id
    
    def add_doc_title_node(self):
        """Add the document title node as root"""
        doc_node = {
            "id": "doc_title",
            "label": self.doc_title,
            "parent_id": None,
            "type": "title"
        }
        self.nodes.append(doc_node)
        return "doc_title"
    
    def add_header_node(self, text, layer):
        """Add a header node and update parent tracking"""
        node_id = self.generate_node_id("header")
        
        # Determine parent based on layer hierarchy
        if layer == 1:
            parent_id = "doc_title"
        else:
            # Find the parent from the previous layer
            parent_layer = layer - 1
            parent_id = self.current_parents.get(parent_layer, "doc_title")
        
        header_node = {
            "id": node_id,
            "label": text,
            "parent_id": parent_id,
            "type": f"header_l{layer}"
        }
        self.nodes.append(header_node)
        
        # Update current parent for this layer
        self.current_parents[layer] = node_id
        
        # Clear deeper layers (if a layer 2 header appears, clear layer 3+ parents)
        layers_to_clear = [l for l in self.current_parents.keys() if l > layer]
        for l in layers_to_clear:
            del self.current_parents[l]
        
        return node_id
    
    def add_content_node(self, text):
        """Add a content node under the most recent header"""
        node_id = self.generate_node_id("content")
        
        # Find the most recent header (highest layer number)
        if self.current_parents:
            # Get the deepest layer's header as parent
            deepest_layer = max(self.current_parents.keys())
            parent_id = self.current_parents[deepest_layer]
        else:
            # Fallback to doc title if no headers found yet
            parent_id = "doc_title"
        
        content_node = {
            "id": node_id,
            "label": text,
            "parent_id": parent_id,
            "type": "content"
        }
        self.nodes.append(content_node)
        
        return node_id
    
    def fetch_paragraphs_from_db(self):
        """Fetch paragraphs from database ordered by paragraph_id"""
        conn = None
        paragraphs = []
        
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            
            query = """
                SELECT paragraph_id, kind, text, header_layer
                FROM paragraphs 
                WHERE doc_id = %s 
                ORDER BY paragraph_id
            """
            
            cur.execute(query, (self.doc_id,))
            rows = cur.fetchall()
            
            for row in rows:
                paragraphs.append({
                    'paragraph_id': row[0],
                    'kind': row[1],
                    'text': row[2],
                    'header_layer': row[3]
                })
                
        except (Exception, psycopg2.DatabaseError) as error:
            print(f"Error fetching paragraphs: {error}")
        finally:
            if conn:
                cur.close()
                conn.close()
        
        return paragraphs
    
    def create_mindmap_json(self):
        """Main method to create the mindmap JSON structure"""
        # Add document title as root
        self.add_doc_title_node()
        
        # Fetch paragraphs from database
        paragraphs = self.fetch_paragraphs_from_db()
        print(f"Fetched {len(paragraphs)} paragraphs from database")
        
        # Find first header
        first_header_found = False
        for paragraph in paragraphs:
            # Skip until we find the first header
            if not first_header_found:
                if paragraph['header_layer'] is not None:
                    first_header_found = True
                else:
                    continue
            
            # Process this paragraph
            if paragraph['header_layer'] is not None:
                # This is a header
                self.add_header_node(paragraph['text'], paragraph['header_layer'])
                print(f"Added header (layer {paragraph['header_layer']}): {paragraph['text'][:50]}...")
            else:
                # This is content
                self.add_content_node(paragraph['text'])
                print(f"Added content: {paragraph['text'][:50]}...")
        
        return self.nodes
    
    def write_json_file(self, output_path):
        """Write the nodes to a JSON file"""
        nodes = self.create_mindmap_json()
        
        try:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(nodes, f, indent=2, ensure_ascii=False)
            
            print(f"Successfully wrote {len(nodes)} nodes to {output_path}")
            
        except Exception as e:
            print(f"Error writing JSON file: {e}")

def main():
    # Determine the project root (go up from backend/processing/headlines/)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(current_dir, "..", "..", "..")
    output_path = os.path.join(project_root, "mindmap-tool", "static", "js", "examples", "sample_input_test.json")
    
    print(f"Creating JSON for doc_id=1...")
    print(f"Output path: {output_path}")
    
    # Create JSON
    creator = JsonCreator(doc_id=1, doc_title="Test title")
    creator.write_json_file(output_path)
    
    print("JSON creation complete!")

if __name__ == "__main__":
    main() 