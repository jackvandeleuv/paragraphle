import onnxruntime as ort
import numpy as np
from transformers import AutoTokenizer
import time

# 66 chunks per second

model_dir = "bge-small-en-v1.5-onnx" 
tokenizer = AutoTokenizer.from_pretrained(model_dir)
session   = ort.InferenceSession(f"{model_dir}/onnx/model.onnx",
                                 providers=["CPUExecutionProvider"])
print('session loaded')

def embed(texts, batch=42):
    out = []
    for i in range(0, len(texts), batch):
        enc = tokenizer(
            texts[i:i+batch],
            padding=True,
            truncation=True,
            return_tensors="np",
            return_token_type_ids=True
        )

        # Some tokenizers omit token_type_ids; create an all‑zero tensor if needed
        if "token_type_ids" not in enc:
            enc["token_type_ids"] = np.zeros_like(enc["input_ids"])

        # 👉 Cast everything to int64 because the ONNX model expects that dtype
        for k in ("input_ids", "attention_mask", "token_type_ids"):
            enc[k] = enc[k].astype("int64", copy=False)

        (vecs,) = session.run(
            None,
            {
                "input_ids":      enc["input_ids"],
                "attention_mask": enc["attention_mask"],
                "token_type_ids": enc["token_type_ids"],
            },
        )

        vecs = vecs / np.linalg.norm(vecs, axis=1, keepdims=True)
        out.append(vecs.astype("float32"))

    return np.vstack(out)


n = 300
docs  = ["Anarchism is a political philosophy and movement that is skeptical of all justifications for authority and seeks to abolish the institutions it claims maintain unnecessary coercion and hierarchy, typically including nation-states, and capitalism. Anarchism advocates for the replacement of the"] * n
start    = time.time()
embs  = embed(docs)
print(time.time() - start)
print('docs per second:', n / (time.time() - start))
