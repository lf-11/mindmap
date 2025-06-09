#!/usr/bin/env python3
"""
Script to analyze token counts for each line in a German OCR-parsed .md file.
Uses the local vLLM tokenization endpoint to count tokens per line.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path so we can import local_call
sys.path.append(str(Path(__file__).parent.parent))

from utils.local_call import get_token_count_from_api, get_first_model_name

# --- Configuration ---
MD_FILE_PATH = "/home/lukas/projects/pdf_mindmap/backend/processing/marker_output/ZPO_temp/ZPO.md"  # SPECIFY YOUR .MD FILE PATH HERE
VLLM_API_BASE = "http://localhost:8000/v1"
MODELS_ENDPOINT = f"{VLLM_API_BASE.replace('/v1', '')}/v1/models"
TOKEN_THRESHOLD = 1024
# --- ---

def analyze_md_file_tokens(file_path: str, model_id: str, threshold: int = 1024):
    """
    Analyze token counts for each line in an .md file.
    
    Args:
        file_path: Path to the .md file
        model_id: Model identifier for tokenization
        threshold: Token count threshold to flag lines
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} does not exist.")
        return
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return
    
    print(f"Analyzing {len(lines)} lines from: {file_path}")
    print(f"Using model: {model_id}")
    print(f"Token threshold: {threshold}")
    print("-" * 50)
    
    over_threshold_lines = []
    line_token_counts = []
    
    for line_num, line in enumerate(lines, 1):
        # Skip empty lines
        line_content = line.strip()
        if not line_content:
            continue
            
        # Get token count for this line
        token_count = get_token_count_from_api(model_id, line_content)
        
        if token_count is None:
            print(f"Warning: Could not get token count for line {line_num}")
            continue
        
        line_token_counts.append((line_num, token_count, line_content))
        
        # Check if line exceeds threshold
        if token_count > threshold:
            over_threshold_lines.append((line_num, token_count, line_content))
        
        # Progress indicator
        if line_num % 100 == 0:
            print(f"Processed {line_num} lines...")
    
    # Results
    print(f"\nAnalysis complete!")
    print(f"Total lines processed: {len(line_token_counts)}")
    print(f"Lines with more than {threshold} tokens: {len(over_threshold_lines)}")
    
    if over_threshold_lines:
        print(f"\nLines exceeding {threshold} tokens:")
        for line_num, token_count, content in over_threshold_lines:
            preview = content[:100] + "..." if len(content) > 100 else content
            print(f"  Line {line_num}: {token_count} tokens - {preview}")
    
    # Top 5 lines with most tokens
    print(f"\nTop 5 lines with highest token counts:")
    sorted_lines = sorted(line_token_counts, key=lambda x: x[1], reverse=True)
    for i, (line_num, token_count, content) in enumerate(sorted_lines[:5], 1):
        preview = content[:100] + "..." if len(content) > 100 else content
        print(f"  {i}. Line {line_num}: {token_count} tokens - {preview}")

def main():
    if not os.path.exists(MD_FILE_PATH):
        print(f"Please update MD_FILE_PATH in the script to point to your .md file.")
        print(f"Current path: {MD_FILE_PATH}")
        return
    
    # Get the first available model
    print("Fetching available model...")
    model_id = get_first_model_name(MODELS_ENDPOINT)
    if not model_id:
        print("Error: Could not get model ID from the server.")
        return
    
    print("Starting token analysis for German OCR text...")
    analyze_md_file_tokens(MD_FILE_PATH, model_id, TOKEN_THRESHOLD)

if __name__ == "__main__":
    main() 