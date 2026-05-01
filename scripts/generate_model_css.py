#!/usr/bin/env python3
"""
Generate CSS for model layouts based on analysis.
This script will help create the CSS rules for each model (1-14).
"""

# Based on the pattern described: rounded, center-concentrated, starting with middle photo
# I'll create layouts that follow this pattern for each model

models = {
    1: {
        "description": "1 photo - large centered",
        "layout": [
            {"n": 1, "col": "4 / 10", "row": "span 4"}
        ]
    },
    2: {
        "description": "2 photos - side by side, centered",
        "layout": [
            {"n": 1, "col": "3 / 7", "row": "span 3"},
            {"n": 2, "col": "7 / 11", "row": "span 3"}
        ]
    },
    3: {
        "description": "3 photos - center large, 2 smaller around",
        "layout": [
            {"n": 1, "col": "4 / 9", "row": "span 4"},
            {"n": 2, "col": "2 / 5", "row": "span 2"},
            {"n": 3, "col": "9 / 12", "row": "span 2"}
        ]
    },
    # Continue for all models...
}

def generate_css_for_model(model_num, layout_data):
    """Generate CSS rules for a specific model."""
    css_rules = []
    css_rules.append(f"/* Model {model_num}: {layout_data['description']} */")
    
    for item in layout_data['layout']:
        nth = "first-child" if item['n'] == 1 else f"nth-child({item['n']})"
        css_rules.append(
            f".gallery-grid.is-album-mode.model-{model_num} .gallery-card:{nth} {{"
        )
        css_rules.append(f"  grid-column: {item['col']};")
        css_rules.append(f"  grid-row: {item['row']};")
        css_rules.append("}")
    
    return "\n".join(css_rules)

# This is a template - we need to analyze the actual images
# For now, let me create a script that can be run to help map the layouts
print("Model CSS Generator")
print("=" * 50)
print("\nTo create accurate layouts, we need to analyze each model image.")
print("The layouts should follow: rounded, center-concentrated pattern")
print("with highest density in the middle.")

