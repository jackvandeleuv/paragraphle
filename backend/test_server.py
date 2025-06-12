from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import os 

load_dotenv()

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

app = Flask(__name__)
CORS(app)

app.config.update(
    DEBUG=False,      
    ENV="production", 
)

@app.route("/hi")
def hi():
    return "OH HELLO HI", 200
