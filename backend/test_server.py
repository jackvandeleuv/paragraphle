from flask import Flask, jsonify
import sqlite3
from markupsafe import escape
from flask_cors import CORS
from copy import deepcopy
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
import os 
from collections import Counter, defaultdict
from typing import List
import re

load_dotenv()

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

app = Flask(__name__)
CORS(app)

@app.route("/hi")
def hi():
    return "OH HELLO HI", 200
