## Call to llm with correction prompt
import instructor
import openai
from pydantic import BaseModel
from typing import List, Tuple, Literal
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
import os

# Add the project root to the path to import local_call
sys.path.append('/home/lukas/projects/pdf_mindmap')
from backend.utils.local_call import call_qwen3, get_first_model_name, VLLM_API_BASE, API_KEY, MODELS_ENDPOINT
from backend.processing.headlines.prompt_construction import construct_prompt

# Define the structured output for LLM responses
class HeadlineDecision(BaseModel):
    decision_type: Literal["HAUPTGLIEDERUNG", "PRÜFUNGSSCHEMA", "UNSICHERHEIT"]
    layer_number: int | None = None  # Only used for HAUPTGLIEDERUNG
    reasoning: str

def get_instructor_client():
    """Get an instructor-patched OpenAI client for structured output"""
    # Get the model name dynamically
    model_name = get_first_model_name(MODELS_ENDPOINT)
    if not model_name:
        raise Exception("Could not determine model name from vLLM server")
    
    # Create OpenAI client
    openai_client = openai.OpenAI(
        api_key=API_KEY,
        base_url=VLLM_API_BASE,
    )
    
    # Patch with instructor
    client = instructor.from_openai(openai_client)
    return client, model_name

def call_llm_for_correction(prompt_data) -> str:
    """
    First call to LLM with correction prompt using call_qwen3 with thinking mode enabled
    Returns the LLM's natural language response about the headline issue
    """
    try:
        # Construct the correction prompt
        correction_prompt = construct_prompt(prompt_data)
        
        # Use call_qwen3 with all parameters and thinking mode enabled
        response = call_qwen3(
            prompt=correction_prompt,
            temperature=0.1,
            top_p=0.8,
            presence_penalty=1.5,
            enable_thinking=True  # Enable thinking for first call
        )
        
        if response is None:
            return "Error occurred during LLM analysis"
        
        return response
        
    except Exception as e:
        print(f"Error in LLM correction call: {e}")
        return "Error occurred during LLM analysis"

def call_llm_for_structured_decision(correction_response: str, prompt_data) -> HeadlineDecision:
    """
    Second call to LLM with instructor prompt for structured output
    Parses the correction response and returns structured decision
    """
    try:
        # Get instructor client
        client, model_name = get_instructor_client()
        
        # Debug: Print what we're sending to instructor
        print(f"DEBUG: Sending to instructor: {correction_response[:200]}...")
        
        # Create a detailed instruction for the model to parse the correction response
        instruction_prompt = f"""
Analyze this text and extract structured information:

"{correction_response}"

Rules for extraction:
1. If the text indicates this is a "Hauptgliederung" (main structural element), set decision_type to "HAUPTGLIEDERUNG" and determine the appropriate layer number (1-10)
2. If the text indicates this is a "Prüfungsschema" (exam schema), set decision_type to "PRÜFUNGSSCHEMA" and layer_number to null
3. If unclear or uncertain, set decision_type to "UNSICHERHEIT" and layer_number to null

Context: This headline appears at layer {prompt_data.get('current_layer', 'unknown')} but was expected at layer {prompt_data.get('previous_layer', 'unknown')}.

For HAUPTGLIEDERUNG decisions, infer the correct layer number from:
- The structural context described in the text
- The current position (layer {prompt_data.get('current_layer', 'unknown')})
- The pattern mentioned (e.g., "Buchstaben-Nummerierung" suggests layer 3)
"""
        
        # Use instructor with the detailed prompt
        decision = client.chat.completions.create(
            model=model_name,
            response_model=HeadlineDecision,
            messages=[
                {"role": "user", "content": instruction_prompt}
            ],
            temperature=0.1,
            top_p=0.8,
            presence_penalty=1.5,
            max_tokens=200,
            extra_body={
                "chat_template_kwargs": {"enable_thinking": False}  # Disable thinking for structured call
            }
        )
        
        print(f"DEBUG: Instructor returned - Type: {decision.decision_type}, Layer: {decision.layer_number}")
        
        # Validate and fix the decision if needed (fallback for edge cases)
        if decision.decision_type == "HAUPTGLIEDERUNG" and decision.layer_number is None:
            # Try to infer layer number from context
            current_layer = prompt_data.get('current_layer')
            if current_layer and isinstance(current_layer, int):
                print(f"WARNING: LLM didn't provide layer number for HAUPTGLIEDERUNG, inferring from context: {current_layer}")
                decision.layer_number = current_layer
            else:
                print(f"WARNING: LLM didn't provide layer number and couldn't infer from context, defaulting to layer 3")
                decision.layer_number = 3
        
        return decision
        
    except Exception as e:
        print(f"Error in structured LLM call: {e}")
        # Return fallback decision
        return HeadlineDecision(
            decision_type="UNSICHERHEIT",
            reasoning=f"Error occurred: {str(e)}"
        )

def parse_decision_to_result(decision: HeadlineDecision) -> str:
    """
    Parse structured decision into the format expected by the main code
    Returns: "edit, <layer number>" or "remove" or "intervention"
    """
    if decision.decision_type == "HAUPTGLIEDERUNG":
        if decision.layer_number is not None:
            return f"edit, {decision.layer_number}"
        else:
            print("Warning: HAUPTGLIEDERUNG decision without layer number, defaulting to intervention")
            return "intervention"
    
    elif decision.decision_type == "PRÜFUNGSSCHEMA":
        return "remove"
    
    elif decision.decision_type == "UNSICHERHEIT":
        return "intervention"
    
    else:
        print(f"Unknown decision type: {decision.decision_type}")
        return "intervention"

def process_single_error(error_case, prompt_data) -> str:
    """
    Process a single error case through both LLM calls
    Returns the final decision string
    """
    try:
        print(f"Processing error at line {error_case.line_num}: {error_case.headline_text}")
        
        # First call: Get correction analysis
        correction_response = call_llm_for_correction(prompt_data)
        print(f"LLM correction analysis: {correction_response[:100]}...")
        
        # Second call: Get structured decision
        decision = call_llm_for_structured_decision(correction_response, prompt_data)
        print(f"LLM decision: {decision.decision_type}, Layer: {decision.layer_number}, Reasoning: {decision.reasoning}")
        
        # Parse to expected format
        result = parse_decision_to_result(decision)
        print(f"Final result: {result}")
        
        return result
        
    except Exception as e:
        print(f"Error processing error case at line {error_case.line_num}: {e}")
        return "intervention"

def process_errors_concurrently(llm_tasks: List[Tuple]) -> List[str]:
    """
    Process multiple error cases concurrently using ThreadPoolExecutor
    
    Args:
        llm_tasks: List of (error_case, prompt_data) tuples
    
    Returns:
        List of LLM results in the same order as input
    """
    results = [None] * len(llm_tasks)
    
    # Use ThreadPoolExecutor for concurrent processing
    with ThreadPoolExecutor(max_workers=min(len(llm_tasks), 4)) as executor:
        # Submit all tasks
        future_to_index = {
            executor.submit(process_single_error, error_case, prompt_data): i
            for i, (error_case, prompt_data) in enumerate(llm_tasks)
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_index):
            index = future_to_index[future]
            try:
                result = future.result()
                results[index] = result
            except Exception as e:
                print(f"Error processing task {index}: {e}")
                results[index] = "intervention"  # Fallback
    
    return results

