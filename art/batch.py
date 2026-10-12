import subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, ".")
from prompts import JOBS
only = sys.argv[1:] or list(JOBS)
def run(name):
    aspect, prompt = JOBS[name]
    out = f"reference/{name}.png"
    if os.path.exists(out) or os.path.exists(out[:-4] + ".webp"): return f"{name}: exists"
    for attempt in range(2):
        r = subprocess.run(["python3", "gen.py", "google/gemini-3-pro-image", out, aspect, prompt], capture_output=True, text=True, timeout=400)
        if r.returncode == 0: return r.stdout.strip()
    return f"{name}: FAILED {r.stdout[-300:]} {r.stderr[-300:]}"
with ThreadPoolExecutor(6) as pool:
    for line in pool.map(run, only): print(line, flush=True)
