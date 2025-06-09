from jinja2 import Template, Environment, FileSystemLoader
import os

def get_all_layers_info(prompt_data, pattern_trackers, language):
    """
    Get information for all layers starting from 1, filling in gaps with 'Unknown'
    """
    all_layers = {}
    max_layer = max(prompt_data['previous_layer'], prompt_data['current_layer'])
    
    # Fill in all layers from 1 to max_layer
    for layer_num in range(1, max_layer + 1):
        layer_info = get_layer_info_by_num(layer_num, pattern_trackers, language, prompt_data)
        all_layers[layer_num] = layer_info
    
    return all_layers

def get_layer_info_by_num(layer_num, pattern_trackers, language, prompt_data):
    """
    Get layer info for a specific layer number, with fallbacks
    """
    # First check if we have complete layer info
    if 'all_layers_info' in prompt_data and layer_num in prompt_data['all_layers_info']:
        layer_info = prompt_data['all_layers_info'][layer_num]
        return {
            'name': layer_info['layer_name'],
            'numerals': layer_info['layer_numerals']
        }
    
    # Check if this is the previous layer
    if layer_num == prompt_data['previous_layer']:
        return {
            'name': prompt_data['previous_layer_name'],
            'numerals': prompt_data['previous_layer_numerals']
        }
    
    # Check if this is the current layer
    if layer_num == prompt_data['current_layer']:
        return {
            'name': prompt_data['current_layer_name'],
            'numerals': prompt_data['current_layer_numerals']
        }
    
    # Check if this is in expected layers
    for expected_layer in prompt_data['expected_layers_info']:
        if expected_layer['layer_num'] == layer_num:
            return {
                'name': expected_layer['layer_name'],
                'numerals': expected_layer['layer_numerals']
            }
    
    # Default fallback
    return {
        'name': 'Unknown' if language == 'en' else 'Unbekannt',
        'numerals': 'Unknown' if language == 'en' else 'Unbekannt'
    }

def construct_layer_skip_prompt(prompt_data):
    """
    Construct a prompt for layer skip error cases using Jinja2 template
    """
    # Get template directory
    template_dir = os.path.join(os.path.dirname(__file__), 'templates')
    
    # Create Jinja2 environment
    env = Environment(loader=FileSystemLoader(template_dir))
    
    # Load the appropriate template
    if prompt_data['language'] == 'de':
        template = env.get_template('layer_skip_de.txt')
    else:
        template = env.get_template('layer_skip_en.txt')
    
    # Prepare template variables
    # Get all layers info starting from 1
    all_layers = {}
    max_layer = max(prompt_data['previous_layer'], prompt_data['current_layer'])
    
    for layer_num in range(1, max_layer + 1):
        layer_info = get_layer_info_by_num(layer_num, None, prompt_data['language'], prompt_data)
        all_layers[layer_num] = layer_info
    
    # Prepare template context
    context = {
        **prompt_data,
        'all_layers': all_layers,
        'max_layer': max_layer,
        'layer_range': range(1, max_layer + 1)
    }
    
    return template.render(context)

def construct_prompt(prompt_data):
    """
    Main function to construct prompts based on error type
    """
    if prompt_data['error_type'] == 'layer_skip':
        return construct_layer_skip_prompt(prompt_data)
    else:
        return f"Unknown error type: {prompt_data['error_type']}" 