import re

# Read the SQL file
with open('SEED_VEHICLES_FINAL.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Convert ARRAY['item1', 'item2'] to '["item1", "item2"]'::jsonb
def convert_array_to_jsonb(match):
    array_content = match.group(1)
    # Replace single quotes with double quotes for JSON
    json_content = array_content.replace("'", '"')
    return f"'[{json_content}]'::jsonb"

# Pattern to match ARRAY['...', '...']
pattern = r"ARRAY\[((?:'[^']*'(?:,\s*)?)+)\]"
content = re.sub(pattern, convert_array_to_jsonb, content)

# Write the fixed SQL file
with open('SEED_VEHICLES_FINAL.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Converted all ARRAY[] to JSONB format!")
print("File updated: SEED_VEHICLES_FINAL.sql")
