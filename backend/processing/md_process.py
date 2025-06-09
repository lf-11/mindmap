#!/usr/bin/env python3
"""
Script to process German OCR-parsed .md file using local vLLM with batch processing.
Processes lines in batches with single API calls.
"""

import sys
import os
import time
from pathlib import Path
from typing import List, Tuple

# Add the backend directory to the Python path so we can import local_call
sys.path.append(str(Path(__file__).parent.parent))

from utils.local_call import call_qwen3_batch, call_qwen3

# --- Configuration ---
INPUT_MD_FILE = "/home/lukas/projects/pdf_mindmap/backend/processing/marker_output/ZPO_temp/ZPO.md"
OUTPUT_MD_FILE = "/home/lukas/projects/pdf_mindmap/backend/processing/marker_output/ZPO_temp/ZPO_processed.md"
USER_PROMPT_TEMPLATE = "Du bist Teil eines OCR-Fehlerkorrektur-Systems. Du erhältst einen Text im Markdown-Format. Füge Leerzeichen die fehlenden Leerzeichen ein. Verändere sonst nichts. Füge dem Text nichts hinzu, gebe nur den korrigierten Text zurück.\n\nBitte korrigiere den folgenden Text: {text}"
BATCH_SIZE = 110  # Number of lines to process in each batch call
PROGRESS_SAVE_INTERVAL = 20  # Save progress every N processed lines
# --- ---

def process_md_file_batch(input_path: str, output_path: str, user_prompt_template: str, 
                         batch_size: int = 20, progress_save_interval: int = 100):
    """
    Process markdown file using batch API calls.
    
    Args:
        input_path: Path to the input .md file
        output_path: Path to save the processed .md file
        user_prompt_template: The user prompt template to use for processing each line
        batch_size: Number of lines to process in each batch
        progress_save_interval: Save progress every N processed lines
    """
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} does not exist.")
        return
    
    try:
        with open(input_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
    except Exception as e:
        print(f"Error reading input file {input_path}: {e}")
        return
    
    print(f"Processing {len(lines)} lines from: {input_path}")
    print(f"Output will be saved to: {output_path}")
    print(f"Batch size: {batch_size}")
    print(f"Progress save interval: {progress_save_interval}")
    print("-" * 50)
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Separate empty and non-empty lines
    line_data = []  # (line_number, line_content, is_empty)
    non_empty_indices = []  # Track which lines need processing
    
    for i, line in enumerate(lines):
        line_data.append((i + 1, line, not line.strip()))
        if line.strip():  # Non-empty line
            non_empty_indices.append(i)
    
    print(f"Found {len(non_empty_indices)} non-empty lines to process")
    
    # Initialize results array
    processed_lines = lines.copy()  # Start with original lines
    total_processed = 0
    total_failed = 0
    
    try:
        # Process non-empty lines in batches
        for batch_start in range(0, len(non_empty_indices), batch_size):
            batch_end = min(batch_start + batch_size, len(non_empty_indices))
            batch_indices = non_empty_indices[batch_start:batch_end]
            
            print(f"\n--- Processing batch {batch_start//batch_size + 1}: lines {batch_indices[0]+1}-{batch_indices[-1]+1} ---")
            start_time = time.time()
            
            # Prepare batch prompts
            batch_prompts = []
            batch_original_lines = []
            
            for idx in batch_indices:
                line_content = lines[idx].strip()
                prompt = user_prompt_template.format(text=line_content)
                batch_prompts.append(prompt)
                batch_original_lines.append(lines[idx])
            
            # Make batch API call
            try:
                batch_responses = call_qwen3_batch(
                    batch_prompts,
                    temperature=0,
                    top_p=0.8,
                    top_k=20,
                    presence_penalty=1.5,
                    enable_thinking=False
                )
                
                # Process responses
                if len(batch_responses) == len(batch_prompts):
                    for i, (idx, response) in enumerate(zip(batch_indices, batch_responses)):
                        if response and response.strip():
                            # Preserve original line ending
                            original_line = batch_original_lines[i]
                            processed_lines[idx] = response.strip() + original_line[len(original_line.rstrip()):]
                            total_processed += 1
                            print(f"✓ Processed line {idx + 1}")
                        else:
                            total_failed += 1
                            print(f"✗ Failed line {idx + 1}, keeping original")
                else:
                    print(f"Warning: Expected {len(batch_prompts)} responses, got {len(batch_responses)}")
                    total_failed += len(batch_prompts)
                    
            except Exception as e:
                print(f"Batch processing failed: {e}")
                print("Falling back to individual processing for this batch...")
                
                # Fallback to individual calls
                for i, (idx, prompt) in enumerate(zip(batch_indices, batch_prompts)):
                    try:
                        response = call_qwen3(
                            prompt,
                            temperature=0,
                            top_p=0.8,
                            top_k=20,
                            presence_penalty=1.5,
                            enable_thinking=False
                        )
                        
                        if response and response.strip():
                            original_line = batch_original_lines[i]
                            processed_lines[idx] = response.strip() + original_line[len(original_line.rstrip()):]
                            total_processed += 1
                            print(f"✓ Processed line {idx + 1} (individual)")
                        else:
                            total_failed += 1
                            print(f"✗ Failed line {idx + 1}, keeping original")
                    except Exception as e2:
                        print(f"Individual processing failed for line {idx + 1}: {e2}")
                        total_failed += 1
            
            batch_time = time.time() - start_time
            print(f"Batch completed in {batch_time:.2f}s")
            print(f"Progress: {total_processed} successful, {total_failed} failed")
            
            # Save progress periodically
            if total_processed % progress_save_interval == 0:
                save_progress_simple(processed_lines, output_path, total_processed + total_failed, len(non_empty_indices))
        
        # Save final result
        save_final_result(processed_lines, output_path)
        
        # Summary
        print(f"\n" + "=" * 50)
        print(f"Processing complete!")
        print(f"Total lines: {len(lines)}")
        print(f"Non-empty lines: {len(non_empty_indices)}")
        print(f"Successfully processed: {total_processed}")
        print(f"Failed to process: {total_failed}")
        print(f"Output saved to: {output_path}")
        
    except KeyboardInterrupt:
        print(f"\n\nProcessing interrupted by user!")
        print(f"Saving progress...")
        save_final_result(processed_lines, output_path + ".partial")
        print(f"Partial results saved to: {output_path}.partial")
        return
    except Exception as e:
        print(f"Unexpected error during processing: {e}")
        return

def save_progress_simple(processed_lines: list, output_path: str, current_count: int, total_count: int):
    """Save current progress to file."""
    try:
        with open(output_path + ".progress", 'w', encoding='utf-8') as file:
            file.writelines(processed_lines)
        print(f"Progress saved: {current_count}/{total_count} lines processed")
    except Exception as e:
        print(f"Error saving progress: {e}")

def save_final_result(processed_lines: list, output_path: str):
    """Save final processed result to file."""
    try:
        with open(output_path, 'w', encoding='utf-8') as file:
            file.writelines(processed_lines)
        print(f"Final result saved to: {output_path}")
    except Exception as e:
        print(f"Error saving final result: {e}")

def main():
    if not os.path.exists(INPUT_MD_FILE):
        print(f"Please update INPUT_MD_FILE in the script to point to your .md file.")
        print(f"Current path: {INPUT_MD_FILE}")
        return
    
    print("Starting batch markdown file processing with local LLM...")
    print(f"Input: {INPUT_MD_FILE}")
    print(f"Output: {OUTPUT_MD_FILE}")
    print(f"Batch size: {BATCH_SIZE}")
    
    # Ask for confirmation
    response = input("\nProceed with processing? (y/N): ")
    if response.lower() != 'y':
        print("Processing cancelled.")
        return
    
    process_md_file_batch(
        INPUT_MD_FILE, 
        OUTPUT_MD_FILE, 
        USER_PROMPT_TEMPLATE, 
        BATCH_SIZE,
        PROGRESS_SAVE_INTERVAL
    )

if __name__ == "__main__":
    main() 