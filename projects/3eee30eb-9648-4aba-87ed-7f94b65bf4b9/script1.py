# app.py
import os
import openai
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

openai.api_key = os.getenv("OPENAI_API_KEY")

# In-memory conversation memory
conversation_memory = []

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json.get('message')
    conversation_memory.append({"role": "user", "content": user_input})

    # Generate a response from the GPT model
    response = openai.ChatCompletion.create(
        model="gpt-5",
        messages=conversation_memory,
    )

    assistant_response = response['choices'][0]['message']['content']
    conversation_memory.append({"role": "assistant", "content": assistant_response})

    return jsonify({'response': assistant_response})

@app.route('/upload', methods=['POST'])
def upload():
    # Handle document upload and integrate it with the RAG
    # You can implement your document processing logic here
    return jsonify({'message': 'Document uploaded successfully!'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)