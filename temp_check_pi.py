import json

with open("/home/eform-kio/.openclaw/openclaw.json") as f:
    d = json.load(f)

print("=== HOOK MAPPINGS ===")
for m in d.get("hooks", {}).get("mappings", []):
    print(json.dumps(m, indent=2))

print("\n=== WHATSAPP CHANNEL ===")
print(json.dumps(d.get("channels", {}).get("whatsapp", {}), indent=2))

print("\n=== BINDINGS ===")
print(json.dumps(d.get("bindings", []), indent=2))

print("\n=== WHATSAPP AGENT ===")
for a in d.get("agents", {}).get("list", []):
    if a.get("id") == "whatsapp":
        print(json.dumps(a, indent=2))
