## script to call vllm server with dynamic max_tokens

import openai
import requests
import sys
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration ---
# Your Linux machine's local IP address and the default vLLM OpenAI API port
VLLM_API_BASE = "http://localhost:8000/v1"
MODELS_ENDPOINT = f"{VLLM_API_BASE.replace('/v1', '')}/v1/models"
# Construct the tokenize endpoint URL (assuming it's at the same base as the API server)
TOKENIZE_ENDPOINT = f"{VLLM_API_BASE.replace('/v1', '')}/tokenize"

# vLLM doesn't require an API key by default for local setups
API_KEY = "not-needed"

# --- Model Specific Configuration ---
# Define a *default* context limit. This will be updated if the API provides one.
MODEL_CONTEXT_LIMIT = 4096 # Default value
# Define a small buffer to leave some room
TOKEN_BUFFER = 30 # Adjust as needed
# --- ---

# --- Global variable to track if context limit has been updated ---
# This prevents printing the update message on every tokenization call
context_limit_updated = False
# --- ---

def get_first_model_name(endpoint: str) -> str | None:
    """
    Fetches the list of available models from the vLLM server
    and returns the ID of the first model found.

    Args:
        endpoint: The URL of the /v1/models endpoint.

    Returns:
        The ID of the first model, or None if fetching fails or no models are found.
    """
    try:
        response = requests.get(endpoint, timeout=10) # Added timeout
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
        models_data = response.json()

        if models_data and "data" in models_data and len(models_data["data"]) > 0:
            first_model_id = models_data["data"][0].get("id")
            if first_model_id:
                print(f"--- Found model: {first_model_id} ---")
                return first_model_id
            else:
                print("Error: Could not find 'id' key in the first model data.")
                return None
        else:
            print("Error: No model data found in the response from the server.")
            print(f"Response: {models_data}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error fetching models from {endpoint}: {e}")
        print("Please ensure the vLLM server is running and the '/v1/models' endpoint is accessible.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while fetching models: {e}")
        return None

# --- Updated function to call the /tokenize endpoint ---
def get_token_count_from_api(model_id: str, text_to_tokenize: str) -> int | None:
    """
    Calls the vLLM /tokenize endpoint to get the token count for the given text
    and potentially updates the global MODEL_CONTEXT_LIMIT.

    Args:
        model_id: The identifier of the model to use for tokenization.
        text_to_tokenize: The string to tokenize.

    Returns:
        The token count as an integer, or None if an error occurs.
    """
    global MODEL_CONTEXT_LIMIT, context_limit_updated # Declare modification of globals

    headers = {
        'accept': 'application/json',
        'Content-Type': 'application/json',
    }
    data = {
        "model": model_id,
        "prompt": text_to_tokenize,
        "add_special_tokens": True
    }
    try:
        response = requests.post(TOKENIZE_ENDPOINT, headers=headers, json=data, timeout=15)
        response.raise_for_status() # Check for HTTP errors
        result = response.json()

        token_count = result.get("count")

        # --- Update Context Limit ---
        max_len = result.get("max_model_len")
        if max_len is not None and isinstance(max_len, int) and max_len > 0:
            if MODEL_CONTEXT_LIMIT != max_len and not context_limit_updated:
                print(f"--- Updating MODEL_CONTEXT_LIMIT from {MODEL_CONTEXT_LIMIT} to {max_len} (based on /tokenize response) ---")
                MODEL_CONTEXT_LIMIT = max_len
                context_limit_updated = True # Mark as updated
            # Ensure context_limit_updated is True even if the value didn't change,
            # indicating we successfully checked the API value.
            context_limit_updated = True
        # --- ---

        if token_count is not None:
            return int(token_count)
        else:
            print(f"Error: '/tokenize' endpoint response did not contain 'count'. Response: {result}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error calling /tokenize endpoint at {TOKENIZE_ENDPOINT}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during tokenization API call: {e}")
        return None
# --- ---


def call_local_vllm(prompt: str):
    """
    Makes a call to the local vLLM OpenAI-compatible server,
    dynamically fetching the model name and calculating max_tokens using the /tokenize endpoint.

    Args:
        prompt: The user prompt to send to the model.

    Returns:
        The content of the model's response, or None if an error occurs.
    """
    # --- Get Model Name Dynamically ---
    model_name = get_first_model_name(MODELS_ENDPOINT)
    if not model_name:
        print("Exiting script as model name could not be determined.")
        sys.exit(1)
    # --- ---

    # --- Prepare Messages and Calculate Input Tokens using API ---
    system_message = {"role": "system", "content": "Du bist ein hilfreicher Assistent und Experte im Korrigieren von Text."}
    user_message = {"role": "user", "content": prompt}
    messages = [system_message, user_message]

    # Combine message content for tokenization.
    # How messages are combined for tokenization might depend on the specific model's
    # chat template. A simple newline join is a common approach, but might not be perfect.
    # You might need to format it exactly as the model expects for chat.
    text_for_tokenization = "\n".join([msg["content"] for msg in messages])
    # Alternatively, just tokenize the user prompt if system prompt is always the same:
    # text_for_tokenization = prompt # And add a fixed number for the system prompt later

    print(f"--- Requesting token count for input from {TOKENIZE_ENDPOINT} ---")
    input_tokens = get_token_count_from_api(model_name, text_for_tokenization)

    if input_tokens is not None:
        print(f"--- Input Token Count (from API): {input_tokens} ---")
    else:
        print("Warning: Failed to get token count from API. Cannot calculate max_tokens accurately.")
        input_tokens = -1 # Indicate failure

    # --- Calculate max_tokens ---
    # Uses the potentially updated global MODEL_CONTEXT_LIMIT
    if input_tokens != -1 and input_tokens < MODEL_CONTEXT_LIMIT:
        max_response_tokens = MODEL_CONTEXT_LIMIT - input_tokens - TOKEN_BUFFER
        if max_response_tokens <= 0:
            print(f"Error: Input prompt ({input_tokens} tokens) is too long for the model's context limit ({MODEL_CONTEXT_LIMIT} tokens). Cannot generate response.")
            return None
        print(f"--- Max Response Tokens Calculated: {max_response_tokens} ---")
        print(f"--- (Context Limit: {MODEL_CONTEXT_LIMIT}, Input Tokens: {input_tokens}, Buffer: {TOKEN_BUFFER}) ---")
    else:
        # Fallback if token calculation failed or input is already too long
        print("Warning: Using fallback max_tokens value (e.g., 1024). Response might be truncated or API call might fail if input is too long.")
        max_response_tokens = 1024 # Or another sensible default
        if input_tokens >= MODEL_CONTEXT_LIMIT:
             print(f"Error: Input prompt ({input_tokens} tokens) likely exceeds model context limit ({MODEL_CONTEXT_LIMIT}). API call will probably fail.")
    # --- ---

    try:
        # Initialize the OpenAI client
        client = openai.OpenAI(
            api_key=API_KEY,
            base_url=VLLM_API_BASE,
        )

        print(f"--- Sending prompt to {model_name} at {VLLM_API_BASE} ---")
        # print(f"Prompt: {prompt}") # Redundant if printed above

        # Create the chat completion request with calculated max_tokens
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=max_response_tokens, # Use calculated value
            temperature=0,
        )

        # Extract the response content
        if response.choices:
            message_content = response.choices[0].message.content
            print("\n--- Model Response ---")
            print(message_content)
            # Optional: Check actual output tokens reported by API
            if response.usage:
                 output_tokens = response.usage.completion_tokens
                 print(f"Reported Output Tokens: {output_tokens}")
            print("--------------------")
            return message_content
        else:
            print("Error: No response choices received.")
            return None

    except openai.APIConnectionError as e:
        print(f"Connection Error: Failed to connect to the vLLM server at {VLLM_API_BASE}.")
        print(f"Please ensure the server is running and accessible from your Mac.")
        print(f"Details: {e}")
        return None
    except openai.APIError as e:
        print(f"API Error: An error occurred during the API call.")
        print(f"HTTP Status: {e.status_code}")
        # Attempt to print response body if available
        try:
            response_text = e.response.text
            # Check if the error is context length exceeded
            if "context_length_exceeded" in response_text.lower() or \
               (hasattr(e, 'code') and e.code == 'context_length_exceeded'): # Check code if available
                 print("Error Details: The request likely exceeded the model's maximum context length.")
                 # Use the input_tokens calculated earlier
                 print(f"Input Tokens (calculated via API): {input_tokens if input_tokens != -1 else 'Error calculating'}, Requested Max Output Tokens: {max_response_tokens}, Total Limit: {MODEL_CONTEXT_LIMIT}")
            print(f"Response Body: {response_text}")
        except Exception:
             print(f"Response Body: Could not decode response body.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

def call_qwen3(prompt: str, 
              temperature: float = 0,
              top_p: float = 0.8, 
              presence_penalty: float = 1.5,
              enable_thinking: bool = False):
    """
    Makes a call to the local vLLM OpenAI-compatible server with Qwen3-specific parameters,
    dynamically fetching the model name and calculating max_tokens using the /tokenize endpoint.

    Args:
        prompt: The user prompt to send to the model.
        temperature: Controls randomness in generation (0 = deterministic).
        top_p: Nucleus sampling parameter.
        presence_penalty: Penalty for tokens that have appeared in the text so far.
        enable_thinking: Whether to enable thinking mode in chat template.

    Returns:
        The content of the model's response, or None if an error occurs.
    """
    # --- Get Model Name Dynamically ---
    model_name = get_first_model_name(MODELS_ENDPOINT)
    if not model_name:
        print("Exiting as model name could not be determined.")
        return None
    # --- ---

    # --- Prepare Messages and Calculate Input Tokens using API ---
    system_message = {"role": "system", "content": "Du bist ein hilfreicher Assistent und Experte im Korrigieren von Text."}
    user_message = {"role": "user", "content": prompt}
    messages = [system_message, user_message]

    # Combine message content for tokenization
    text_for_tokenization = "\n".join([msg["content"] for msg in messages])

    input_tokens = get_token_count_from_api(model_name, text_for_tokenization)

    if input_tokens is not None:
        print(f"--- Input Token Count (from API): {input_tokens} ---")
    else:
        print("Warning: Failed to get token count from API. Cannot calculate max_tokens accurately.")
        input_tokens = -1

    # --- Calculate max_tokens ---
    if input_tokens != -1 and input_tokens < MODEL_CONTEXT_LIMIT:
        max_response_tokens = MODEL_CONTEXT_LIMIT - input_tokens - TOKEN_BUFFER
        if max_response_tokens <= 0:
            print(f"Error: Input prompt ({input_tokens} tokens) is too long for the model's context limit ({MODEL_CONTEXT_LIMIT} tokens). Cannot generate response.")
            return None
        print(f"--- Max Response Tokens Calculated: {max_response_tokens} ---")
    else:
        print("Warning: Using fallback max_tokens value (2000).")
        max_response_tokens = 2000
        if input_tokens >= MODEL_CONTEXT_LIMIT:
             print(f"Error: Input prompt ({input_tokens} tokens) likely exceeds model context limit ({MODEL_CONTEXT_LIMIT}). API call will probably fail.")
    # --- ---

    try:
        # Initialize the OpenAI client
        client = openai.OpenAI(
            api_key=API_KEY,
            base_url=VLLM_API_BASE,
        )

        print(f"--- Sending prompt to {model_name} at {VLLM_API_BASE} ---")

        # Create the chat completion request with Qwen3-specific parameters
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=max_response_tokens,
            temperature=temperature,
            top_p=top_p,
            presence_penalty=presence_penalty,
            extra_body={
                "chat_template_kwargs": {"enable_thinking": enable_thinking}
            }
        )

        # Extract the response content
        if response.choices:
            message_content = response.choices[0].message.content
            print("\n--- Model Response ---")
            print(message_content)
            if response.usage:
                 output_tokens = response.usage.completion_tokens
                 print(f"Reported Output Tokens: {output_tokens}")
            print("--------------------")
            return message_content
        else:
            print("Error: No response choices received.")
            return None

    except openai.APIConnectionError as e:
        print(f"Connection Error: Failed to connect to the vLLM server at {VLLM_API_BASE}.")
        print(f"Details: {e}")
        return None
    except openai.APIError as e:
        print(f"API Error: An error occurred during the API call.")
        print(f"HTTP Status: {e.status_code}")
        try:
            response_text = e.response.text
            if "context_length_exceeded" in response_text.lower():
                 print("Error Details: The request likely exceeded the model's maximum context length.")
                 print(f"Input Tokens: {input_tokens if input_tokens != -1 else 'Error calculating'}, Requested Max Output Tokens: {max_response_tokens}, Total Limit: {MODEL_CONTEXT_LIMIT}")
            print(f"Response Body: {response_text}")
        except Exception:
             print(f"Response Body: Could not decode response body.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None

def _make_single_chat_request(payload: dict, endpoint_url: str, request_index: int) -> tuple[int, str | None]:
    """
    Helper function to make a single HTTP request for chat completion.
    Returns the original index and the response content or None.
    """
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            endpoint_url,
            headers=headers,
            json=payload,
            timeout=120  # Timeout for individual request
        )
        response.raise_for_status()
        result = response.json()
        if "choices" in result and result["choices"]:
            content = result["choices"][0]["message"]["content"]
            print(f"✓ Request {request_index} successful.")
            return request_index, content
        else:
            print(f"✗ Request {request_index}: No choices in response. Result: {result}")
            return request_index, None
    except requests.exceptions.RequestException as e:
        print(f"✗ Request {request_index} HTTP Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(f"Response Status: {e.response.status_code}, Response Text: {e.response.text}")
            except Exception:
                print("Could not decode error response.")
        return request_index, None
    except Exception as e:
        print(f"✗ Request {request_index} Unexpected Error: {e}")
        return request_index, None

def call_qwen3_batch(prompts: List[str], 
                   temperature: float = 0,
                   top_p: float = 0.8, 
                   presence_penalty: float = 1.5,
                   enable_thinking: bool = False,
                   max_workers: int = 100) -> List[str | None]: # Return list of string or None
    """
    Makes multiple concurrent calls to the local vLLM OpenAI-compatible server 
    (/v1/chat/completions) using direct HTTP requests. Dynamically calculates 
    max_tokens for each prompt.

    Args:
        prompts: List of user prompts to send to the model.
        temperature: Controls randomness.
        top_p: Nucleus sampling.
        presence_penalty: Presence penalty.
        enable_thinking: Chat template thinking mode.
        max_workers: Maximum number of concurrent requests.

    Returns:
        List of response contents (str) or None for failures, in the original order.
    """
    if not prompts:
        return []
        
    model_name = get_first_model_name(MODELS_ENDPOINT)
    if not model_name:
        print("Exiting as model name could not be determined for batch.")
        # Return list of Nones matching prompts length
        return [None] * len(prompts)
    
    print(f"--- Preparing {len(prompts)} concurrent requests for {model_name} at {VLLM_API_BASE}/chat/completions ---")
    
    request_payloads_with_indices = []
    for i, prompt_text in enumerate(prompts):
        system_message_content = "Du bist ein hilfreicher Assistent und Experte im Korrigieren von Text."
        user_message_content = prompt_text
        messages = [
            {"role": "system", "content": system_message_content},
            {"role": "user", "content": user_message_content}
        ]

        text_for_tokenization = f"{system_message_content}\n{user_message_content}"
        input_tokens = get_token_count_from_api(model_name, text_for_tokenization)
        
        current_max_response_tokens = 2000 

        if input_tokens is not None:
            # print(f"--- Prompt {i+1} Input Token Count (from API): {input_tokens} ---") # Can be verbose
            if input_tokens < MODEL_CONTEXT_LIMIT:
                calculated_max_tokens = MODEL_CONTEXT_LIMIT - input_tokens - TOKEN_BUFFER
                if calculated_max_tokens > 0:
                    current_max_response_tokens = calculated_max_tokens
                else:
                    print(f"Warning for prompt {i+1}: Input ({input_tokens} tokens) too long for context limit ({MODEL_CONTEXT_LIMIT}). Using fallback max_tokens={current_max_response_tokens}.")
            else:
                 print(f"Warning for prompt {i+1}: Input ({input_tokens} tokens) exceeds context limit ({MODEL_CONTEXT_LIMIT}). Using fallback max_tokens={current_max_response_tokens}.")
        else:
            print(f"Warning for prompt {i+1}: Failed to get token count. Using fallback max_tokens={current_max_response_tokens}.")

        payload = {
            "model": model_name,
            "messages": messages,
            "max_tokens": current_max_response_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "presence_penalty": presence_penalty,
            "extra_body": {
                "chat_template_kwargs": {"enable_thinking": enable_thinking}
            }
        }
        request_payloads_with_indices.append({'payload': payload, 'index': i})

    results_map = {} # To store results with original index

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []
        for item in request_payloads_with_indices:
            future = executor.submit(
                _make_single_chat_request, 
                item['payload'], 
                f"{VLLM_API_BASE}/chat/completions",
                item['index'] + 1 # For 1-based logging
            )
            futures.append(future)

        for future in as_completed(futures):
            try:
                index, content = future.result()
                results_map[index] = content
            except Exception as e:
                # This case should ideally be handled within _make_single_chat_request
                # but as a fallback:
                print(f"Error retrieving result from future: {e}")
                # We need to find which original index this future corresponds to if it errors out before _make_single_chat_request returns index
                # For now, this is less likely as _make_single_chat_request traps exceptions.
    
    # Reconstruct results in original order
    final_responses: List[str | None] = [None] * len(prompts)
    for i in range(len(prompts)):
        # The index from _make_single_chat_request is 0-based for the map key
        original_prompt_index = request_payloads_with_indices[i]['index']
        final_responses[original_prompt_index] = results_map.get(original_prompt_index)

    print(f"--- Completed {len(prompts)} concurrent requests ---")
    return final_responses

if __name__ == "__main__":
    test_prompt = "Explain the difference between a list and a tuple in Python, providing several examples for each and discussing their use cases in detail."
    call_local_vllm(test_prompt)

    # Example with a potentially longer prompt
    # long_prompt = "Write a comprehensive guide on setting up a basic web server using Python's Flask framework. Include installation, routing, handling requests, templates, static files. Provide code examples for each step."
    # call_local_vllm(long_prompt)