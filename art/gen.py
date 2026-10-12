import json, sys, base64, urllib.request, os
model, out, aspect, prompt = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
body = {"model": model, "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"], "image_config": {"aspect_ratio": aspect}}
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",
    data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
data = json.load(urllib.request.urlopen(req, timeout=300))
msg = data["choices"][0]["message"]
imgs = msg.get("images") or []
if not imgs:
    print("NO IMAGE", json.dumps(data)[:800]); sys.exit(1)
url = imgs[0]["image_url"]["url"]
raw = base64.b64decode(url.split(",", 1)[1])
open(out, "wb").write(raw)
print(out, len(raw), data.get("usage", {}).get("cost"))
