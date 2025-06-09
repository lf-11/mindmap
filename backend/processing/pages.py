import os
import subprocess
import traceback
import re
from pathlib import Path
import shutil
from html import escape
import requests

DEFAULT_PROCESSING_OUTPUT_BASE_DIR = "marker_output"

test_pdf_file = "/home/lukas/Shared/ZPO.pdf" 


def _ensure_dir_exists(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)

def _run_marker_subprocess(
    pdf_file_path: str, 
    output_dir: str, 
    language: str = "de", 
    use_llm: bool = True,
    llm_base_url: str = "http://localhost:8000/v1",
    llm_api_key: str = "not-needed",
    llm_model: str = None
):
    cmd = [
        "marker_single",
        str(pdf_file_path),
        "--output_dir", str(output_dir),
        "--languages", language,
    ]

    if use_llm:
        cmd.extend([
            "--use_llm",
            "--llm_service", "marker.services.openai.OpenAIService",
            "--openai_base_url", llm_base_url,
        ])
        
        # Only add API key if it's not the default "not-needed" value
        if llm_api_key != "not-needed":
            cmd.extend(["--openai_api_key", llm_api_key])
            
        # Add model name if provided
        if llm_model:
            cmd.extend(["--openai_model", llm_model])
    
    print(f"Running Marker: {' '.join(cmd)}")
    process = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    
    if process.returncode != 0:
        print(f"Marker command failed: {process.stderr}")
    return process.stdout, process.stderr, process.returncode

def format_markdown_paragraphs(text: str) -> str:
    if not text:
        return ""
    paragraphs = re.split(r'\n\s*\n', text)
    formatted_paragraphs = []
    for p in paragraphs:
        p_stripped = p.strip()
        if p_stripped.startswith(('- ', '• ', '* ')) or \
           re.match(r'^\d+\.\s', p_stripped) or \
           re.search(r'```|~~~', p):
            formatted_paragraphs.append(p)
        else:
            formatted_p = re.sub(r'(?<!\n)\n(?!\n)', ' ', p)
            formatted_paragraphs.append(formatted_p)
    return '\n\n'.join(formatted_paragraphs)

def process_pdf_file(
    pdf_file_path_str: str, 
    processing_output_base_dir: str = DEFAULT_PROCESSING_OUTPUT_BASE_DIR, 
    language: str = "de",
    use_marker_llm: bool = False,
    cleanup_marker_output: bool = True,
    llm_base_url: str = "http://localhost:8000/v1",
    llm_api_key: str = "not-needed",
    llm_model: str = None
) -> tuple[str | None, list[str], str | None, str | None]:
    """
    Processes a PDF using Marker, formats text, and identifies images.
    Returns: (formatted_text, image_paths, raw_marker_md_content, error_message)
    """
    pdf_file_path = Path(pdf_file_path_str)
    if not pdf_file_path.is_file():
        return None, [], None, f"PDF file not found: {pdf_file_path_str}"

    pdf_basename = pdf_file_path.stem
    # This is the directory *passed to* marker's --output_dir. 
    # And it's where we want the files to ultimately reside.
    final_content_parent_dir = Path(processing_output_base_dir) / f"{pdf_basename}_temp"
    _ensure_dir_exists(str(final_content_parent_dir))

    # This is the actual directory where marker initially places the .md and image files (its default behavior).
    marker_initial_output_dir = final_content_parent_dir / pdf_basename

    raw_marker_md_content = None
    formatted_text = None
    image_paths_absolute = []

    try:
        stdout, stderr, returncode = _run_marker_subprocess(
            str(pdf_file_path.resolve()), 
            str(final_content_parent_dir.resolve()),
            language,
            use_marker_llm,
            llm_base_url,
            llm_api_key,
            llm_model
        )
        
        # Check if Marker created its default subdirectory
        if marker_initial_output_dir.exists() and marker_initial_output_dir.is_dir():
            # Move contents from Marker's default subfolder to the parent (desired location)
            print(f"Moving contents from {marker_initial_output_dir} to {final_content_parent_dir}")
            for item_path in marker_initial_output_dir.iterdir():
                destination_path = final_content_parent_dir / item_path.name
                if destination_path.exists(): # Handle potential name collision
                    print(f"Warning: Destination {destination_path} already exists. Overwriting.")
                    if destination_path.is_dir():
                        shutil.rmtree(destination_path)
                    else:
                        os.remove(destination_path)
                shutil.move(str(item_path), str(destination_path))
            # Remove Marker's now-empty default subfolder
            shutil.rmtree(marker_initial_output_dir)
            actual_content_dir = final_content_parent_dir
        elif any(final_content_parent_dir.iterdir()):
            # Files might be directly in final_content_parent_dir (e.g. if marker changes behavior or error)
            print(f"Content found directly in {final_content_parent_dir}, not in a subfolder.")
            actual_content_dir = final_content_parent_dir
        else:
            # No content found in expected nested location or the parent.
            if returncode != 0:
                 err_msg = f"Marker failed (code {returncode}) and no output found in {marker_initial_output_dir} or {final_content_parent_dir}. Stderr: {stderr}"
            else:
                 err_msg = f"Marker ran (code {returncode}) but no output found in {marker_initial_output_dir} or {final_content_parent_dir}. Stderr: {stderr}"
            
            if cleanup_marker_output:
                shutil.rmtree(final_content_parent_dir, ignore_errors=True)
            return None, [], None, err_msg


        # Now, files should be in actual_content_dir (which is final_content_parent_dir)
        markdown_glob_path = actual_content_dir / '*.md'
        markdown_files = list(actual_content_dir.glob('*.md'))

        if not markdown_files:
            message = f"No markdown file found in {actual_content_dir} (searched for {markdown_glob_path})."
            if cleanup_marker_output:
                shutil.rmtree(final_content_parent_dir, ignore_errors=True)
            return None, [], None, message
        
        markdown_path = markdown_files[0] # Use the first .md file found
        
        with open(markdown_path, 'r', encoding='utf-8') as f:
            raw_marker_md_content = f.read()
        
        formatted_text = format_markdown_paragraphs(raw_marker_md_content)
        
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')
        image_files_relative = [
            f.name for f in actual_content_dir.iterdir() 
            if f.is_file() and f.suffix.lower() in image_extensions
        ]
        image_paths_absolute = [str((actual_content_dir / img_name).resolve()) for img_name in image_files_relative]
        
        print(f"Processed PDF. Markdown: {markdown_path}, Images found: {len(image_paths_absolute)} in {actual_content_dir}")

        if cleanup_marker_output:
            # If cleaning up, image paths will become invalid unless copied elsewhere by the caller.
            # Consider copying images to a persistent location before this if needed.
            print(f"Cleaning up Marker output directory: {final_content_parent_dir}")
            shutil.rmtree(final_content_parent_dir, ignore_errors=True)
            if image_paths_absolute:
                 print("Warning: cleanup_marker_output is True, returned image paths are now invalid unless copied.")

        return formatted_text, image_paths_absolute, raw_marker_md_content, None
        
    except Exception as e:
        error_message = f"Error processing PDF {pdf_file_path_str}: {str(e)}\n{traceback.format_exc()}"
        print(error_message)
        if 'final_content_parent_dir' in locals() and Path(final_content_parent_dir).exists() and cleanup_marker_output:
            shutil.rmtree(final_content_parent_dir, ignore_errors=True)
        return None, [], None, error_message

def highlight_differences(original_text: str, formatted_text: str) -> dict:
    original_html = f"<pre>{escape(original_text)}</pre>"
    formatted_html_paragraphs = [escape(p) for p in formatted_text.split('\n\n')]
    formatted_html = f"<div>{'<br><br>'.join(formatted_html_paragraphs)}</div>"
    return {"original": original_html, "formatted": formatted_html}

def get_model_name(base_url: str) -> str:
    """Get the first available model name from the vLLM server"""
    models_endpoint = f"{base_url.replace('/v1', '')}/v1/models"
    try:
        response = requests.get(models_endpoint, timeout=10)
        response.raise_for_status()
        models_data = response.json()
        
        if models_data and "data" in models_data and len(models_data["data"]) > 0:
            first_model_id = models_data["data"][0].get("id")
            if first_model_id:
                print(f"Found model: {first_model_id}")
                return first_model_id
        return None
    except Exception as e:
        print(f"Error fetching model name: {e}")
        return None

if __name__ == '__main__':

    if not Path(test_pdf_file).exists():
        print(f"Test PDF file '{test_pdf_file}' not found.")
        print("Please edit the script to provide a valid path to a PDF file for testing,")
        print("or place a PDF named 'test_document.pdf' in the same directory as this script.")
    else:
        print(f"Processing '{test_pdf_file}'...")
        # Set cleanup_marker_output to False if you want to inspect Marker's raw output directory.
        llm_base_url = "http://localhost:8000/v1"
        model_name = get_model_name(llm_base_url)
        
        formatted_content, images, raw_md, err = process_pdf_file(
            test_pdf_file,
            cleanup_marker_output=False,
            use_marker_llm=True,
            llm_model=model_name
        )

        if err:
            print(f"\n--- Processing Error ---")
            print(err)
        else:
            print(f"\n--- Formatted Text ---")
            print(formatted_content if formatted_content else "No formatted text.")
            
            print(f"\n--- Extracted Image Paths ---")
            if images:
                for img_path in images:
                    print(img_path)
            else:
                print("No images extracted.")
