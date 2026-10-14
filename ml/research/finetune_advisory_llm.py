"""Fine-tune a lightweight instruction model for Ethiopian smallholder agronomic advisory.

This script uses Hugging Face PEFT (QLoRA) to fine-tune an instruction model
(such as Qwen2.5-3B-Instruct or Llama-3.2-3B-Instruct) on Ethiopian agronomic QA
in English, Amharic, and Afaan Oromoo.

Requirements:
    pip install torch transformers datasets peft bitsandbytes accelerate trl

Usage:
    python ml/research/finetune_advisory_llm.py \\
        --model_name_or_path "Qwen/Qwen2.5-3B-Instruct" \\
        --data_dir "ml/research/data/finetuning" \\
        --output_dir "ml/research/models/agriminds-advisory-lora"
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

log = logging.getLogger("agriminds_finetune")


def generate_finetune_recipe(model_name: str, data_dir: Path, output_dir: Path) -> str:
    """Return a standalone executable recipe script for Hugging Face QLoRA training."""
    return f'''# Auto-generated AgriMinds QLoRA Fine-Tuning Pipeline
import os
import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

MODEL_ID = "{model_name}"
DATA_DIR = "{data_dir}"
OUTPUT_DIR = "{output_dir}"

print(f"Loading dataset from {{DATA_DIR}}...")
dataset = load_dataset(
    "json",
    data_files={{
        "train": os.path.join(DATA_DIR, "farmer_advisory_train.jsonl"),
        "validation": os.path.join(DATA_DIR, "farmer_advisory_val.jsonl"),
    }}
)

print(f"Configuring 4-bit quantization for {{MODEL_ID}}...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
model = prepare_model_for_kbit_training(model)

peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, peft_config)

def formatting_prompts_func(example):
    output_texts = []
    for i in range(len(example["instruction"])):
        text = (
            f"<|im_start|>system\\nYou are AgriMinds AI-DREWS, an agricultural expert for Ethiopian smallholders in Choke Mountain Watershed.<|im_end|>\\n"
            f"<|im_start|>user\\n{{example['instruction'][i]}}\\nContext: {{example['input'][i]}}<|im_end|>\\n"
            f"<|im_start|>assistant\\n{{example['output'][i]}}<|im_end|>"
        )
        output_texts.append(text)
    return output_texts

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    num_train_epochs=3,
    logging_steps=10,
    save_strategy="epoch",
    eval_strategy="epoch",
    fp16=not (torch.cuda.is_available() and torch.cuda.is_bf16_supported()),
    bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
    report_to="none",
)

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    peft_config=peft_config,
    formatting_func=formatting_prompts_func,
    max_seq_length=1024,
    tokenizer=tokenizer,
    args=training_args,
)

print("Starting training...")
trainer.train()

print(f"Saving fine-tuned LoRA adapter to {{OUTPUT_DIR}}...")
trainer.model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print("Fine-tuning completed successfully!")
'''


def main() -> None:
    parser = argparse.ArgumentParser(description="AgriMinds fine-tuning recipe generator")
    parser.add_argument("--model_name_or_path", default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--data_dir", type=Path, default=Path("ml/research/data/finetuning"))
    parser.add_argument("--output_dir", type=Path, default=Path("ml/research/models/agriminds-advisory-lora"))
    parser.add_argument("--write_recipe", type=Path, default=Path("ml/research/train_lora_recipe.py"))
    args = parser.parse_args()

    recipe = generate_finetune_recipe(args.model_name_or_path, args.data_dir, args.output_dir)
    args.write_recipe.write_text(recipe, encoding="utf-8")
    print(f"Generated standalone QLoRA fine-tuning recipe at: {args.write_recipe}")


if __name__ == "__main__":
    main()
