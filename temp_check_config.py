import json
c = json.load(open('/home/eform-kio/.openclaw/openclaw.json'))
print('mappings count:', len(c['hooks']['mappings']))
for i, m in enumerate(c['hooks']['mappings']):
    print(f'  mapping {i}: id={m.get("id")}, action={m.get("action")}')
print('wa allowFrom:', c['channels']['whatsapp'].get('allowFrom'))
print('wa dmPolicy:', c['channels']['whatsapp'].get('dmPolicy'))
