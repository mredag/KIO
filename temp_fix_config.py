import json, sys

with open(sys.argv[1], 'r') as f:
    config = json.load(f)

# Remove the invalid whatsapp-lifecycle hook mapping
config['hooks']['mappings'] = [m for m in config['hooks']['mappings'] if m.get('id') != 'whatsapp-lifecycle']

# Add allowFrom to whatsapp channel
config['channels']['whatsapp']['allowFrom'] = ['*']

with open(sys.argv[1], 'w') as f:
    json.dump(config, f, indent=2)

print('Config fixed OK')
