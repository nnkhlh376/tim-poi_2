# Translation Server Setup Guide

## Installation

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Required Packages
- `googletrans==3.1.0a0` - Google Translate API wrapper
- `Flask==2.3.3` - Web framework
- `Flask-CORS==4.0.0` - Enable CORS for cross-origin requests

## Running the Server

### Start the Translation Server
```bash
python translate_server.py
```

The server will start on `http://localhost:5000`

### Expected Output
```
Starting Translation Server...
Available at http://localhost:5000
Endpoints:
  POST /translate - Translate text
  POST /detect - Detect language
  GET /languages - Get supported languages
  GET /health - Health check
 * Running on http://127.0.0.1:5000
```

## API Endpoints

### 1. POST /translate
Translate text from source language to target language

**Request:**
```json
{
  "text": "Hello, how are you?",
  "src": "en",
  "dest": "vi"
}
```

**Response:**
```json
{
  "success": true,
  "original_text": "Hello, how are you?",
  "translated_text": "Xin chào, bạn khỏe không?",
  "src_language": "en",
  "dest_language": "vi"
}
```

### 2. POST /detect
Detect the language of input text

**Request:**
```json
{
  "text": "Xin chào"
}
```

**Response:**
```json
{
  "success": true,
  "detected_language": "vi",
  "confidence": 1.0,
  "language_name": "vietnamese"
}
```

### 3. GET /languages
Get list of all supported languages

**Response:**
```json
{
  "success": true,
  "languages": {
    "af": "afrikaans",
    "ar": "arabic",
    "en": "english",
    "vi": "vietnamese",
    ...
  }
}
```

### 4. GET /health
Health check

**Response:**
```json
{
  "status": "OK",
  "message": "Translation server is running"
}
```

## Supported Language Codes

Common travel-related languages:
- `en` - English
- `vi` - Vietnamese
- `fr` - French
- `es` - Spanish
- `zh-CN` - Simplified Chinese
- `zh-TW` - Traditional Chinese
- `ja` - Japanese
- `ko` - Korean
- `th` - Thai
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian

For full list, use the `/languages` endpoint or check `LANGUAGES` dictionary in googletrans

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'googletrans'"
**Solution:** Install packages from requirements.txt
```bash
pip install -r requirements.txt
```

### Issue: "Connection refused" or "Cannot connect to localhost:5000"
**Solution:** Make sure the Flask server is running
```bash
python translate_server.py
```

### Issue: Translation returns empty or slow
**Solution:** This is normal behavior of googletrans - it uses an unofficial API
- First request may be slower due to initialization
- Very long texts may timeout
- Consider implementing request batching for multiple texts

### Issue: Port 5000 is already in use
**Solution:** Change the port in `translate_server.py`:
```python
app.run(debug=True, port=5001)  # Use different port
```

## Integration Notes

The JavaScript frontend automatically:
1. Tries to use the Python Flask backend first
2. Falls back to MyMemory API if the Python server is not available
3. Displays appropriate error messages

This provides a seamless experience whether or not the Python backend is running.

## Features Implemented

✅ Translate text between multiple languages
✅ Auto-detect source language
✅ Get list of supported languages
✅ Error handling with fallback API
✅ CORS support for frontend integration
✅ Logging for debugging
✅ Health check endpoint

## Next Steps

1. Run `python translate_server.py` to start the translation backend
2. Open the application in browser
3. Click "Dịch thuật" button to open translation popup
4. Enter text and select source/target languages
5. Click "Dịch" to translate using the Python backend

Enjoy seamless translations powered by Google Translate!
