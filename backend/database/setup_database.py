import psycopg2
from psycopg2 import sql

# --- Database Connection Parameters ---
# IMPORTANT: Replace 'your_secure_password_here' with the actual password you set.
DB_CONFIG = {
    "dbname": "pdf_reader",
    "user": "postgres",
    "password": "postgres", # CHANGE THIS!
    "host": "192.168.178.61",
    "port": "5432"
}

# --- SQL Table Definitions ---
TABLE_DEFINITIONS = [
    """
    CREATE TABLE IF NOT EXISTS docs (
        doc_id SERIAL PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        file_format VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        doc_title TEXT,
        doc_author TEXT,
        doc_kind VARCHAR(100)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS methods (
        method_id SERIAL PRIMARY KEY,
        method_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        model VARCHAR(255),
        temperature REAL,
        system_prompt TEXT,
        prompt TEXT,
        language VARCHAR(50),
        process_type VARCHAR(50) -- e.g., 'page', 'paragraph', 'header'
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pages (
        doc_id INTEGER NOT NULL,
        page_sequence_number INTEGER NOT NULL, -- The 1st, 2nd, Nth page in the document sequence
        text_content TEXT,
        displayed_page_number TEXT, -- The label printed on the page, e.g., "iv", "12", "A-3"
        PRIMARY KEY (doc_id, page_sequence_number),
        FOREIGN KEY (doc_id) REFERENCES docs (doc_id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS page_processing_log (
        log_id SERIAL PRIMARY KEY,
        doc_id INTEGER NOT NULL,
        page_sequence_number INTEGER NOT NULL,
        method_id INTEGER NOT NULL,
        retrial_id INTEGER NOT NULL DEFAULT 1,
        input_data TEXT,
        output_data TEXT,
        status VARCHAR(50) DEFAULT 'pending', -- e.g., 'pending', 'processing', 'success', 'failed'
        error_message TEXT,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doc_id, page_sequence_number) REFERENCES pages (doc_id, page_sequence_number) ON DELETE CASCADE,
        FOREIGN KEY (method_id) REFERENCES methods (method_id) ON DELETE CASCADE,
        UNIQUE (doc_id, page_sequence_number, method_id, retrial_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS paragraphs (
        doc_id INTEGER NOT NULL,
        page_id INTEGER,
        paragraph_id INTEGER NOT NULL,
        kind VARCHAR(50) DEFAULT 'text', -- 'text', 'footnotes', 'other'
        text TEXT,
        header_layer INTEGER, -- stores the layer number for headers, NULL for regular paragraphs
        file_path TEXT, -- for images etc.
        PRIMARY KEY (doc_id, paragraph_id),
        FOREIGN KEY (doc_id) REFERENCES docs (doc_id) ON DELETE CASCADE
    );
    """
    # You can add more CREATE TABLE statements here for future tables
]

def create_tables():
    """Connects to the PostgreSQL database and creates tables."""
    conn = None
    try:
        # Connect to the PostgreSQL server
        print(f"Connecting to database '{DB_CONFIG['dbname']}'...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Create tables one by one
        for table_sql in TABLE_DEFINITIONS:
            print(f"Executing: {table_sql.strip().splitlines()[0]} ...") # Print first line of SQL
            cur.execute(table_sql)
        
        # Commit the changes
        conn.commit()
        print("Tables created successfully or already exist.")

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error while connecting to PostgreSQL or creating tables: {error}")
        if conn:
            conn.rollback() # Rollback changes on error
    finally:
        # Close the communication with the PostgreSQL
        if conn:
            cur.close()
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    # This confirms that the user has likely changed the password placeholder
    if DB_CONFIG["password"] == "your_secure_password_here":
        print("IMPORTANT: Please open backend/database/setup_database.py and change the DB_PASSWORD placeholder.")
    else:
        create_tables() 