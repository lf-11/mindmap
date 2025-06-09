import os
import re
import psycopg2
from psycopg2 import sql

# Database configuration - should match your setup_database.py
DB_CONFIG = {
    "dbname": "pdf_reader",
    "user": "postgres",
    "password": "postgres",  # Make sure this matches your actual password
    "host": "192.168.178.61",
    "port": "5432"
}

class HeadlineParser:
    def __init__(self, doc_id=1):
        self.doc_id = doc_id
        self.headers = {}  # Will store current headers for each layer
        
    def parse_headlines_file(self, headlines_file):
        """Parse the headlines file to extract header information"""
        headers_map = {}  # paragraph_id -> {layer: header_text}
        
        with open(headlines_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('Line '):
                    # Extract line number and layer information
                    # Format: "Line 7: Layer 1: I. Arten von Säumnisentscheidungen"
                    match = re.match(r'Line (\d+): Layer (\d+): (.+)', line)
                    if match:
                        line_num = int(match.group(1))
                        layer = int(match.group(2))
                        header_text = match.group(3)
                        
                        # Clean up any annotations like [INHERITED], [LLM_MODIFIED], etc.
                        header_text = re.sub(r'\s*\[.*?\]', '', header_text).strip()
                        
                        if line_num not in headers_map:
                            headers_map[line_num] = {}
                        headers_map[line_num][layer] = header_text
        
        return headers_map
    
    def parse_processed_md(self, processed_file, headers_map):
        """Parse the processed markdown file and create paragraph records"""
        paragraphs = []
        
        with open(processed_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for paragraph_id, line in enumerate(lines, 1):
            text = line.strip()
            
            # Skip empty lines but still assign paragraph_id
            if not text:
                continue
            
            # Check if this line is a header
            header_layer = None
            if paragraph_id in headers_map:
                # Get the layer number for this header (assuming only one layer per line)
                header_layer = list(headers_map[paragraph_id].keys())[0]
            
            # Determine paragraph kind
            kind = 'text'  # Default to text, you can add logic to detect footnotes/other
            
            # Create paragraph record
            paragraph = {
                'doc_id': self.doc_id,
                'page_id': None,  # You can add logic to determine page_id if needed
                'paragraph_id': paragraph_id,
                'kind': kind,
                'text': text,
                'header_layer': header_layer,  # Single column now
                'file_path': None  # For non-text content
            }
            
            paragraphs.append(paragraph)
        
        return paragraphs
    
    def insert_paragraphs_to_db(self, paragraphs):
        """Insert paragraphs into the database"""
        conn = None
        try:
            print(f"Connecting to database...")
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            
            # Clear existing paragraphs for this document
            cur.execute("DELETE FROM paragraphs WHERE doc_id = %s", (self.doc_id,))
            print(f"Cleared existing paragraphs for doc_id {self.doc_id}")
            
            # Insert new paragraphs
            insert_query = """
                INSERT INTO paragraphs (
                    doc_id, page_id, paragraph_id, kind, text,
                    header_layer, file_path
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s
                )
            """
            
            for paragraph in paragraphs:
                cur.execute(insert_query, (
                    paragraph['doc_id'],
                    paragraph['page_id'],
                    paragraph['paragraph_id'],
                    paragraph['kind'],
                    paragraph['text'],
                    paragraph['header_layer'],
                    paragraph['file_path']
                ))
            
            conn.commit()
            print(f"Successfully inserted {len(paragraphs)} paragraphs into database")
            
        except (Exception, psycopg2.DatabaseError) as error:
            print(f"Error while inserting paragraphs: {error}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                cur.close()
                conn.close()
                print("Database connection closed.")

def main():
    # File paths
    base_path = "/home/lukas/projects/pdf_mindmap/backend/processing"
    processed_file = os.path.join(base_path, "marker_output/ZPO_temp/ZPO_processed.md")
    headlines_file = os.path.join(base_path, "headlines/ZPO_headlines.md")
    
    # Check if files exist
    if not os.path.exists(processed_file):
        print(f"Error: Processed file not found at {processed_file}")
        return
    
    if not os.path.exists(headlines_file):
        print(f"Error: Headlines file not found at {headlines_file}")
        return
    
    # Initialize parser
    parser = HeadlineParser(doc_id=1)  # You can change doc_id as needed
    
    print(f"Parsing headlines from {headlines_file}...")
    headers_map = parser.parse_headlines_file(headlines_file)
    print(f"Found {len(headers_map)} header entries")
    
    print(f"Parsing processed markdown from {processed_file}...")
    paragraphs = parser.parse_processed_md(processed_file, headers_map)
    print(f"Created {len(paragraphs)} paragraph records")
    
    # Insert into database
    print("Inserting paragraphs into database...")
    parser.insert_paragraphs_to_db(paragraphs)
    
    print("Processing complete!")

if __name__ == "__main__":
    main() 