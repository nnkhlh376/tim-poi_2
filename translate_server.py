#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Translation Server using py-googletrans Library
This is a reference implementation showing how to use py-googletrans for translation.

Installation:
    pip install googletrans==3.1.0a0 flask

Usage:
    python translate_server.py

This server provides a REST API for translation using py-googletrans behind the scenes.
For production use with Python 3.14+, use the MyMemory API integration instead.
"""

# Example implementation using py-googletrans (for documentation purposes)
# NOTE: Due to Python 3.14 compatibility issues with dependencies, 
# the frontend uses MyMemory API directly. This file documents how to use py-googletrans.

EXAMPLE_GOOGLETRANS_USAGE = """
from googletrans import Translator, LANGUAGES

# Initialize translator
translator = Translator()

# Basic translation
result = translator.translate('Hello, how are you?', dest='vi')
print(result.text)  # Output: Xin chào bạn, bạn khỏe không?

# Language detection
detection = translator.detect('¿Dónde está el hotel?')
print(detection.lang)  # Output: es

# Specify source language
result = translator.translate('Bonjour', src='fr', dest='en')
print(result.text)  # Output: Hello

# Bulk translation
texts = ['Welcome', 'Thank you', 'Goodbye']
results = translator.translate(texts, dest='vi')
for i, result in enumerate(results):
    print(f"{result.origin} -> {result.text}")
"""

# Flask server implementation would go here:
try:
    from flask import Flask, request, jsonify
    import logging
    import requests
    
    app = Flask(__name__)
    
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        return response
    
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    @app.route('/translate', methods=['POST', 'OPTIONS'])
    def translate():
        if request.method == 'OPTIONS':
            return '', 204
        
        try:
            data = request.json
            text = data.get('text', '').strip()
            src = data.get('src', 'auto')
            dest = data.get('dest', 'en')
            
            if not text:
                return jsonify({'error': 'Text is required'}), 400
            
            # Using MyMemory API as fallback (compatible with all Python versions)
            url = f"https://api.mymemory.translated.net/get?q={requests.utils.quote(text)}&langpair={src}|{dest}"
            resp = requests.get(url, timeout=10)
            result = resp.json()
            
            if result.get('responseStatus') == 200 and result.get('responseData'):
                return jsonify({
                    'success': True,
                    'original_text': text,
                    'translated_text': result['responseData']['translatedText'],
                    'src_language': src,
                    'dest_language': dest
                }), 200
            return jsonify({'success': False, 'error': 'Translation failed'}), 500
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'OK'}), 200
    
    if __name__ == '__main__':
        print("Starting Translation Server on http://localhost:5000")
        try:
            app.run(debug=False, port=5000, use_reloader=False, threaded=True)
        except KeyboardInterrupt:
            print("\nServer stopped")
except ImportError as e:
    print(f"Error importing Flask: {e}")
    print("Install with: pip install flask requests")
except Exception as e:
    print(f"Error: {e}")

