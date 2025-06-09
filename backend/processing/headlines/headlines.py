import re
import os

# =============================================================================
# CORE CLASSES AND DATA STRUCTURES
# =============================================================================

class PatternTracker:
    def __init__(self, pattern_type):
        self.pattern_type = pattern_type
        self.layer = None
        
        if pattern_type == 'roman':
            self.sequence = ['I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.', 'VIII.', 'IX.', 'X.',
                           'XI.', 'XII.', 'XIII.', 'XIV.', 'XV.', 'XVI.', 'XVII.', 'XVIII.', 'XIX.', 'XX.']
        elif pattern_type == 'upper_letter':
            self.sequence = [f"{chr(i)}." for i in range(65, 91)]  # A. to Z.
        elif pattern_type == 'number':
            self.sequence = [f"{i}." for i in range(1, 101)]  # 1. to 100.
        elif pattern_type == 'lower_paren':
            self.sequence = [f"{chr(i)})" for i in range(97, 123)]  # a) to z)
            
        self.current_idx = 0
        self.first_value = self.sequence[0] if self.sequence else None
    
    def matches_next(self, text):
        """Check if text matches the next expected value in the sequence"""
        if self.current_idx >= len(self.sequence):
            return False
        return text.startswith(self.sequence[self.current_idx])
    
    def matches_first(self, text):
        """Check if text matches the first value in the sequence"""
        return text.startswith(self.first_value)
    
    def advance(self):
        self.current_idx += 1
        
    def reset(self):
        """Reset the tracker to start from the beginning of its sequence"""
        self.current_idx = 1  # Set to 1 because we just found the first value

# Pattern metadata for LLM prompting
PATTERN_METADATA = {
    'roman': {
        'name_en': 'Roman numerals',
        'name_de': 'Römische Ziffern',
        'sample_numerals': 'I., II., III.'
    },
    'upper_letter': {
        'name_en': 'Uppercase letters',
        'name_de': 'Großbuchstaben',
        'sample_numerals': 'A., B., C.'
    },
    'number': {
        'name_en': 'Arabic numbers',
        'name_de': 'Arabische Zahlen',
        'sample_numerals': '1., 2., 3.'
    },
    'lower_paren': {
        'name_en': 'Lowercase letters with parentheses',
        'name_de': 'Kleinbuchstaben mit Klammern',
        'sample_numerals': 'a), b), c)'
    }
}

class ErrorCase:
    def __init__(self, error_type, line_num, headline_text, details):
        self.error_type = error_type
        self.line_num = line_num
        self.headline_text = headline_text
        self.details = details

# =============================================================================
# BASIC UTILITY FUNCTIONS
# =============================================================================

# Detects document language (German vs English) based on common German words
def detect_language(headlines):
    """
    Simple heuristic to detect if document is German or English
    Based on common German words in headlines
    """
    german_indicators = ['und', 'der', 'die', 'das', 'nach', 'gegen', 'von', 'zur', 'zum', 'Entscheidung', 'Verfahren']
    german_count = 0
    total_words = 0
    
    for headline in headlines:
        if 'cleaned_text' in headline:
            words = headline['cleaned_text'].lower().split()
            total_words += len(words)
            german_count += sum(1 for word in words if word in german_indicators)
    
    # If more than 10% of words are German indicators, consider it German
    return 'de' if total_words > 0 and (german_count / total_words) > 0.1 else 'en'

# Gets layer metadata (name, numerals) for a specific layer number from pattern trackers
def get_layer_info(layer_num, pattern_trackers, language):
    """
    Get information about a specific layer for LLM prompting
    """
    for pattern_type, tracker in pattern_trackers.items():
        if tracker.layer == layer_num:
            metadata = PATTERN_METADATA[pattern_type]
            return {
                'layer_name': metadata[f'name_{language}'],
                'layer_numerals': metadata['sample_numerals'],
                'pattern_type': pattern_type
            }
    return None

# =============================================================================
# ERROR TYPE 1: DUPLICATE HEADERS (Execution Order: 1st)
# Handles headers that appear multiple times, often with page numbers appended
# =============================================================================

# Detects duplicate headers where one is substring of another (page number issue)
def detect_duplicate_headers(headlines):
    """
    Detect duplicate headers, especially those with page numbers incorrectly parsed
    """
    error_cases = []
    
    for i in range(len(headlines)):
        current = headlines[i]
        
        # Skip if current header is already marked for removal
        if current.get('marked_for_removal', False):
            continue
            
        for j in range(i + 1, len(headlines)):
            other = headlines[j]
            
            # Skip if other header is already marked for removal
            if other.get('marked_for_removal', False):
                continue
            
            current_text = current['cleaned_text'].strip()
            other_text = other['cleaned_text'].strip()
            
            # Check for exact duplicates OR substring duplicates
            if current_text == other_text:
                # Exact duplicate - remove the later one
                other['marked_for_removal'] = True
                error_case = ErrorCase(
                    error_type="duplicate_header",
                    line_num=other['line_num'],
                    headline_text=other['cleaned_text'],
                    details={
                        'duplicate_of_line': current['line_num'],
                        'duplicate_of_text': current['cleaned_text'],
                        'action': 'remove_exact_duplicate'
                    }
                )
            elif current_text in other_text or other_text in current_text:
                # Mark the longer one for removal (it likely has the page number)
                if len(current_text) > len(other_text):
                    current['marked_for_removal'] = True
                    error_case = ErrorCase(
                        error_type="duplicate_header",
                        line_num=current['line_num'],
                        headline_text=current['cleaned_text'],
                        details={
                            'duplicate_of_line': other['line_num'],
                            'duplicate_of_text': other['cleaned_text'],
                            'action': 'remove_longer'
                        }
                    )
                else:
                    other['marked_for_removal'] = True
                    error_case = ErrorCase(
                        error_type="duplicate_header",
                        line_num=other['line_num'],
                        headline_text=other['cleaned_text'],
                        details={
                            'duplicate_of_line': current['line_num'],
                            'duplicate_of_text': current['cleaned_text'],
                            'action': 'remove_longer'
                        }
                    )
                
                error_cases.append(error_case)
                break  # Move to next header once we found a duplicate
    
    return error_cases

# Removes headers that have been marked for removal during duplicate detection
def remove_marked_headers(headlines):
    """
    Remove headers that have been marked for removal
    """
    return [h for h in headlines if not h.get('marked_for_removal', False)]

# =============================================================================
# ERROR TYPE 2: UNCLEAR HEADERS (Execution Order: 2nd)
# Handles headers without recognizable numeral patterns by inheriting from previous header
# =============================================================================

# Assigns unclear headers the same layer as the previous valid header
def handle_unclear_headers(headlines):
    """
    Assign unclear headers the same layer as the previous header
    """
    error_cases = []
    
    for i in range(len(headlines)):
        current = headlines[i]
        
        # Skip headers marked for removal
        if current.get('marked_for_removal', False):
            continue
            
        if current['layer'] == "unclear":
            # Find the previous valid header
            previous_layer = None
            for j in range(i - 1, -1, -1):
                prev_header = headlines[j]
                if (not prev_header.get('marked_for_removal', False) and 
                    isinstance(prev_header['layer'], int)):
                    previous_layer = prev_header['layer']
                    break
            
            if previous_layer is not None:
                # Assign the same layer as previous header
                current['layer'] = previous_layer
                current['layer_text'] = f"Layer {previous_layer}: {current['cleaned_text']} (inherited layer - no numeral pattern)"
                current['inherited_layer'] = True
                
                error_case = ErrorCase(
                    error_type="unclear_header_assigned",
                    line_num=current['line_num'],
                    headline_text=current['cleaned_text'],
                    details={
                        'assigned_layer': previous_layer,
                        'reason': 'no_numeral_pattern'
                    }
                )
                error_cases.append(error_case)
            else:
                # No previous layer found, assign layer 1 as fallback
                current['layer'] = 1
                current['layer_text'] = f"Layer 1: {current['cleaned_text']} (fallback layer - no numeral pattern)"
                current['inherited_layer'] = True
                
                error_case = ErrorCase(
                    error_type="unclear_header_assigned",
                    line_num=current['line_num'],
                    headline_text=current['cleaned_text'],
                    details={
                        'assigned_layer': 1,
                        'reason': 'no_numeral_pattern_fallback'
                    }
                )
                error_cases.append(error_case)
    
    return error_cases

# =============================================================================
# ERROR TYPE 3: LAYER SKIPS (Execution Order: 3rd)
# Detects and handles cases where layer hierarchy jumps (e.g., layer 2 to layer 4)
# These require LLM intervention for resolution
# =============================================================================

# Detects cases where layers are skipped (e.g., layer 4 after layer 2)
def detect_layer_skips(headlines):
    """
    Detect cases where layers are skipped (e.g., layer 4 after layer 2)
    """
    error_cases = []
    
    for i in range(1, len(headlines)):
        current = headlines[i]
        previous = headlines[i-1]
        
        # Only check numeric layers
        if (isinstance(current['layer'], int) and isinstance(previous['layer'], int)):
            layer_jump = current['layer'] - previous['layer']
            
            # Check for downward skips (layer increases by more than 1)
            if layer_jump > 1:
                skipped_layers = list(range(previous['layer'] + 1, current['layer']))
                
                error_case = ErrorCase(
                    error_type="layer_skip",
                    line_num=current['line_num'],
                    headline_text=current['cleaned_text'],
                    details={
                        'previous_layer': previous['layer'],
                        'current_layer': current['layer'],
                        'skipped_layers': skipped_layers,
                        'previous_headline': previous['cleaned_text'],
                        'previous_line_num': previous['line_num']
                    }
                )
                error_cases.append(error_case)
    
    return error_cases

def extract_section_text(error_case, headlines, input_file):
    """
    Extract the actual text content from the last correct header to the next correct header (inclusive)
    """
    # Find the index of the problematic headline
    error_index = None
    for i, headline in enumerate(headlines):
        if headline['line_num'] == error_case.line_num:
            error_index = i
            break
    
    if error_index is None:
        return ""
    
    # Find the previous correct header (the one before the error)
    start_index = error_index - 1
    while start_index >= 0:
        if isinstance(headlines[start_index]['layer'], int):
            break
        start_index -= 1
    
    # Find the next correct header after the problematic section
    end_index = error_index + 1
    problematic_layer = headlines[error_index]['layer']
    while end_index < len(headlines):
        current_headline = headlines[end_index]
        # Stop when we find a header that's not problematic (different layer or unclear)
        if (isinstance(current_headline['layer'], int) and 
            current_headline['layer'] != problematic_layer) or current_headline['layer'] == "unclear":
            break
        end_index += 1
    
    # Extract line numbers range
    start_line = headlines[start_index]['line_num'] if start_index >= 0 else 1
    
    # Include the next correct header by extending to the line AFTER it
    if end_index < len(headlines):
        # If there's a header after the next correct one, go up to that line
        if end_index + 1 < len(headlines):
            end_line = headlines[end_index + 1]['line_num']
        else:
            # If this is the last header, include some lines after it
            end_line = headlines[end_index]['line_num'] + 10  # Include 10 lines after the last header
    else:
        end_line = None
    
    # Read the actual text content
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Extract the relevant section
        if end_line and end_line <= len(lines):
            section_lines = lines[start_line-1:end_line-1]  # -1 because line numbers are 1-based
        elif end_line:
            # If end_line exceeds file length, just go to end of file
            section_lines = lines[start_line-1:]
        else:
            section_lines = lines[start_line-1:]
        
        section_text = ''.join(section_lines).strip()
        
    except Exception as e:
        print(f"Error reading section text: {e}")
        section_text = "Error reading section text"
    
    return section_text

# Finds all headers that share the same problematic layer as the error case
def find_problematic_headers_same_layer(error_case, headlines):
    """
    Find all headers that have the same problematic layer as the error case
    """
    problematic_layer = None
    error_index = None
    
    # Find the error case in headlines
    for i, headline in enumerate(headlines):
        if headline['line_num'] == error_case.line_num:
            problematic_layer = headline['layer']
            error_index = i
            break
    
    if problematic_layer is None or error_index is None:
        return []
    
    problematic_headers = []
    
    # Look forward from the error case to find all headers of the same problematic layer
    for i in range(error_index, len(headlines)):
        headline = headlines[i]
        if headline['layer'] == problematic_layer:
            problematic_headers.append({
                'line_num': headline['line_num'],
                'text': headline['cleaned_text']
            })
        elif isinstance(headline['layer'], int) and headline['layer'] != problematic_layer:
            # Stop when we hit a different valid layer
            break
    
    return problematic_headers

# Creates structured data for LLM prompting based on the error case
def create_llm_prompt_data(error_case, headlines, pattern_trackers, language, input_file):
    """
    Create structured data for LLM prompting based on error case
    """
    prompt_data = {
        'error_type': error_case.error_type,
        'language': language,
        'problematic_headline': error_case.headline_text,
        'line_number': error_case.line_num
    }
    
    if error_case.error_type == "layer_skip":
        details = error_case.details
        
        # Get layer information
        previous_layer_info = get_layer_info(details['previous_layer'], pattern_trackers, language)
        current_layer_info = get_layer_info(details['current_layer'], pattern_trackers, language)
        
        # Get expected layer information for skipped layers
        expected_layers_info = []
        for skipped_layer in details['skipped_layers']:
            layer_info = get_layer_info(skipped_layer, pattern_trackers, language)
            if layer_info:
                expected_layers_info.append({
                    'layer_num': skipped_layer,
                    'layer_name': layer_info['layer_name'],
                    'layer_numerals': layer_info['layer_numerals']
                })
        
        # Get ALL layer information for complete context
        all_layers_info = {}
        max_layer = max(details['previous_layer'], details['current_layer'])
        for layer_num in range(1, max_layer + 1):
            layer_info = get_layer_info(layer_num, pattern_trackers, language)
            if layer_info:
                all_layers_info[layer_num] = {
                    'layer_name': layer_info['layer_name'],
                    'layer_numerals': layer_info['layer_numerals']
                }
        
        # Find the section text (actual content)
        section_text = extract_section_text(error_case, headlines, input_file)
        
        # Find all problematic headers of the same layer
        problematic_headers = find_problematic_headers_same_layer(error_case, headlines)
        
        prompt_data.update({
            'previous_layer': details['previous_layer'],
            'current_layer': details['current_layer'],
            'skipped_layers': details['skipped_layers'],
            'previous_headline': details['previous_headline'],
            'previous_line_num': details['previous_line_num'],
            'previous_layer_name': previous_layer_info['layer_name'] if previous_layer_info else 'Unknown',
            'previous_layer_numerals': previous_layer_info['layer_numerals'] if previous_layer_info else 'Unknown',
            'current_layer_name': current_layer_info['layer_name'] if current_layer_info else 'Unknown',
            'current_layer_numerals': current_layer_info['layer_numerals'] if current_layer_info else 'Unknown',
            'expected_layers_info': expected_layers_info,
            'all_layers_info': all_layers_info,
            'section_text': section_text,
            'problematic_headers': problematic_headers
        })
    
    return prompt_data

def apply_llm_result(error_case, llm_result, headlines):
    """
    Apply the LLM's decision to the headlines
    """
    # Find all headlines that belong to this error case
    problematic_headers = find_problematic_headers_same_layer(error_case, headlines)
    
    if llm_result.startswith("edit, "):
        # Extract the new layer number
        new_layer = int(llm_result.split(", ")[1])
        print(f"LLM decision: Reassign headers to layer {new_layer}")
        
        # Update all problematic headers to the new layer
        for header_info in problematic_headers:
            for headline in headlines:
                if headline['line_num'] == header_info['line_num']:
                    headline['layer'] = new_layer
                    headline['layer_text'] = f"Layer {new_layer}: {headline['cleaned_text']} (LLM reassigned)"
                    headline['llm_modified'] = True
                    break
    
    elif llm_result == "remove":
        print(f"LLM decision: Remove problematic headers")
        
        # Mark all problematic headers for removal
        for header_info in problematic_headers:
            for headline in headlines:
                if headline['line_num'] == header_info['line_num']:
                    headline['marked_for_removal'] = True
                    break
    
    elif llm_result == "intervention":
        print(f"LLM decision: Manual intervention required for headers at lines {[h['line_num'] for h in problematic_headers]}")
        
        # Mark headers for manual intervention
        for header_info in problematic_headers:
            for headline in headlines:
                if headline['line_num'] == header_info['line_num']:
                    headline['intervention_required'] = True
                    headline['layer_text'] = f"INTERVENTION: {headline['layer_text']}"
                    break
    
    else:
        print(f"Unknown LLM result: {llm_result}")

# =============================================================================
# MAIN PROCESSING FUNCTION
# Execution Order: Initial headline extraction → Error handling (1,2,3) → Output
# =============================================================================

# Main function that orchestrates the entire headline extraction and error handling process
def extract_headlines_with_hierarchy(input_file, output_file):
    # Initialize pattern trackers
    roman_tracker = PatternTracker('roman')
    letter_tracker = PatternTracker('upper_letter')
    number_tracker = PatternTracker('number')
    lower_paren_tracker = PatternTracker('lower_paren')
    
    pattern_trackers = {
        'roman': roman_tracker,
        'upper_letter': letter_tracker,
        'number': number_tracker,
        'lower_paren': lower_paren_tracker
    }
    
    headlines = []
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Error: File {input_file} not found.")
        return
        
    # PHASE 1: Extract headlines and assign initial layers
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        
        if line.startswith('##'):
            headline_text = line.lstrip('#').strip()
            headline_text = headline_text.strip('*').strip()
            
            # Check if this headline should be skipped due to being a duplicate
            should_skip = False
            
            # Look ahead in the remaining lines to see if there's a shorter version of this headline
            for future_line_num, future_line in enumerate(lines[line_num:], line_num + 1):
                future_line = future_line.strip()
                if future_line.startswith('##'):
                    future_headline_text = future_line.lstrip('#').strip()
                    future_headline_text = future_headline_text.strip('*').strip()
                    
                    current_text = headline_text.strip()
                    future_text = future_headline_text.strip()
                    
                    # Check for exact duplicates OR substring duplicates
                    if current_text == future_text:
                        # Exact duplicate - skip the first occurrence (keep the later one)
                        should_skip = True
                        break
                    elif current_text in future_text or future_text in current_text:
                        # If current header is longer, skip it (it likely has the page number)
                        if len(current_text) > len(future_text):
                            should_skip = True
                            break
            
            # Also check against already processed headlines
            for existing_headline in headlines:
                if existing_headline.get('marked_for_removal', False):
                    continue
                    
                existing_text = existing_headline['cleaned_text'].strip()
                current_text = headline_text.strip()
                
                # Check for exact duplicates OR substring duplicates
                if current_text == existing_text:
                    # Exact duplicate - skip current one (keep the first occurrence)
                    should_skip = True
                    break
                elif current_text in existing_text or existing_text in current_text:
                    # Mark the longer one for removal (it likely has the page number)
                    if len(current_text) > len(existing_text):
                        # Current header is longer, skip processing it entirely
                        should_skip = True
                        break
                    else:
                        # Existing header is longer, mark it for removal
                        existing_headline['marked_for_removal'] = True
                        break
            
            # Skip processing if current header should be removed due to being a duplicate
            if should_skip:
                continue
            
            if "IX." in headline_text:
                print(f"Processing: {headline_text}")
                print(f"Roman tracker - current_idx: {roman_tracker.current_idx}")
                print(f"Roman tracker - expected next: {roman_tracker.sequence[roman_tracker.current_idx] if roman_tracker.current_idx < len(roman_tracker.sequence) else 'END'}")
                print(f"Roman tracker layer: {roman_tracker.layer}")
            
            matched_tracker = None
            
            # First, try to match with next expected value in each pattern
            for tracker in pattern_trackers.values():
                if tracker.matches_next(headline_text):
                    matched_tracker = tracker
                    if tracker.layer is None:
                        used_layers = {t.layer for t in pattern_trackers.values() if t.layer is not None}
                        if not used_layers:
                            tracker.layer = 1
                        else:
                            tracker.layer = max(used_layers) + 1
                    tracker.advance()
                    break
            
            # If no match found, check if it matches the first value of any pattern
            if not matched_tracker:
                for tracker in pattern_trackers.values():
                    if tracker.matches_first(headline_text):
                        matched_tracker = tracker
                        if tracker.layer is None:
                            used_layers = {t.layer for t in pattern_trackers.values() if t.layer is not None}
                            if not used_layers:
                                tracker.layer = 1
                            else:
                                tracker.layer = max(used_layers) + 1
                        tracker.reset()
                        break
            
            if matched_tracker:
                layer = matched_tracker.layer
                layer_text = f"Layer {layer}: {headline_text}"
            else:
                layer = "unclear"
                layer_text = f"Layer unclear: {headline_text}"

            headlines.append({
                'line_num': line_num,
                'layer_text': layer_text,
                'layer': layer,
                'cleaned_text': headline_text,
                'original_text': line,
                'inherited_layer': False
            })
    
    # PHASE 2: Language detection
    language = detect_language(headlines)
    print(f"Detected language: {language}")
    
    # PHASE 3: Error handling in order
    
    # ERROR TYPE 1: Handle duplicates first (execution order: 1st) - simplified since we already handled it
    headlines = remove_marked_headers(headlines)
    
    # ERROR TYPE 2: Handle unclear headers (execution order: 2nd)
    unclear_errors = handle_unclear_headers(headlines)
    if unclear_errors:
        print(f"Assigned layers to {len(unclear_errors)} unclear headers")
        for error in unclear_errors:
            print(f"  - Line {error.line_num}: assigned layer {error.details['assigned_layer']}")
    
    # ERROR TYPE 3: Detect layer skips (execution order: 3rd - requires LLM)
    layer_skip_errors = detect_layer_skips(headlines)
    
    # Process layer skip errors with LLM concurrently
    if layer_skip_errors:
        from llm_headline import process_errors_concurrently
        
        # Prepare prompt data for all errors
        llm_tasks = []
        for error in layer_skip_errors:
            prompt_data = create_llm_prompt_data(error, headlines, pattern_trackers, language, input_file)
            llm_tasks.append((error, prompt_data))
        
        print(f"Processing {len(layer_skip_errors)} layer skip errors with LLM...")
        
        # Process all errors concurrently
        llm_results = process_errors_concurrently(llm_tasks)
        
        # Apply LLM results to headlines
        for error, result in zip(layer_skip_errors, llm_results):
            apply_llm_result(error, result, headlines)
    
    # PHASE 4: Write output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# Extracted Headlines with Hierarchy\n\n")
            
            # Remove headers marked for removal after LLM processing
            headlines = remove_marked_headers(headlines)
            
            # Count different types of modifications
            llm_modified_count = sum(1 for h in headlines if h.get('llm_modified', False))
            intervention_count = sum(1 for h in headlines if h.get('intervention_required', False))
            
            if unclear_errors:
                f.write(f"**Info: {len(unclear_errors)} unclear headers assigned inherited layers**\n")
            if llm_modified_count:
                f.write(f"**Info: {llm_modified_count} headers reassigned by LLM**\n")
            if intervention_count:
                f.write(f"**Warning: {intervention_count} headers require manual intervention**\n")
            f.write("\n")
            
            for headline in headlines:
                layer_text = headline['layer_text']
                if headline.get('inherited_layer', False):
                    layer_text += " [INHERITED]"
                elif headline.get('llm_modified', False):
                    layer_text += " [LLM_MODIFIED]"
                elif headline.get('intervention_required', False):
                    layer_text += " [INTERVENTION_REQUIRED]"
                f.write(f"Line {headline['line_num']}: {layer_text}\n")
    except Exception as e:
        print(f"Error writing output file: {e}")

def main():
    base_path = "/home/lukas/projects/pdf_mindmap/backend/processing"
    input_file = os.path.join(base_path, "marker_output/ZPO_temp/ZPO_processed.md")
    output_file = os.path.join(base_path, "headlines/ZPO_headlines.md")
    
    print(f"Processing headlines from {input_file}...")
    extract_headlines_with_hierarchy(input_file, output_file)
    print(f"Output written to {output_file}")

if __name__ == "__main__":
    main()