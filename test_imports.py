#!/usr/bin/env python
import sys
print("Python:", sys.executable)
print("Path:", sys.path[:3])
try:
    import requests
    print("✓ requests: OK")
except Exception as e:
    print("✗ requests error:", e)

try:
    from flask import Flask
    print("✓ flask: OK")
except Exception as e:
    print("✗ flask error:", e)

print("\nTrying to import translate_server...")
try:
    import translate_server
    print("✓ translate_server loaded")
except Exception as e:
    print("✗ translate_server error:", e)
    import traceback
    traceback.print_exc()
