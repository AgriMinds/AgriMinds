"""Curate and format open agricultural datasets for fine-tuning AgriMinds models.

This tool compiles open Ethiopian agronomic guidelines (MoA 8028, EIAR variety manuals,
FAO crop guides) into standard Hugging Face instruction-tuning JSONL format (Alpaca / ShareGPT)
for English, Amharic, and Afaan Oromoo.

Usage:
    python ml/research/prepare_agronomic_finetune_data.py --output-dir ml/research/data/finetuning
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("agriminds_finetune_data")

# Core seed agronomic instructions based on Ethiopian Ministry of Agriculture (MoA),
# Ethiopian Institute of Agricultural Research (EIAR), and ATA 8028 guidelines.
SEED_AGRONOMIC_CORPUS = [
    # English
    {
        "instruction": "When is the optimal planting window for Tef (Eragrostis tef) in the Choke Mountain watershed during a High El Niño season?",
        "input": "Crop: Tef (Quncho variety). Location: Sinan woreda, East Gojjam, Amhara. Agro-ecology: Midland/Woina Dega. Pacific Niño 3.4 anomaly: +1.5°C.",
        "output": "Under a High El Niño phase, Kiremt onset is typically delayed and early dry spells are common. For midland Choke watershed (Sinan), delay tef sowing to early-to-mid July once consistent soil moisture is established. Use certified drought-tolerant seed varieties like Quncho or Boset. Practice contour bunding to retain soil moisture.",
        "language": "en",
        "category": "planting_window"
    },
    {
        "instruction": "How should a smallholder farmer manage soil moisture during a mid-season dry spell in the Ethiopian highlands?",
        "input": "Crop: Bread Wheat. Soil condition: Moderately dry. Forecast: Dry spell exceeding 12 days during grain filling.",
        "output": "Prioritise supplemental water harvesting or furrow irrigation if available during panicle emergence and grain filling. Apply crop residue mulching to reduce evapotranspiration. If rainfall resumes, avoid nitrogen top-dressing until steady moisture returns to prevent crop scorch.",
        "language": "en",
        "category": "water_management"
    },
    {
        "instruction": "What certified seed variety is recommended for tef in the Woina Dega (midland) zone of East Gojjam?",
        "input": "Zone: Woina Dega (1,500 - 2,500m elevation). Target: High yield and lodging tolerance.",
        "output": "For Woina Dega elevations in East Gojjam, EIAR recommends Quncho (DZ-Cr-37) for high yield under normal rainfall, and Boset (DZ-Cr-409) or Kora (DZ-Cr-438) for areas with shorter rainy seasons or moisture stress. Sowing rate should be 10-15 kg/ha if row planted, or 25-30 kg/ha if broadcast.",
        "language": "en",
        "category": "seed_variety"
    },
    
    # Amharic (አማርኛ)
    {
        "instruction": "በከፍተኛ ኤል ኒኞ (El Niño) ወቅት በቾቄ ተራራ ዙሪያ የጤፍ መዝሪያ ወቅት መቼ ነው?",
        "input": "ሰብል፡ ጤፍ (ቁንጮ)። አካባቢ፡ ሲናን ወረዳ፣ ምሥራቅ ጎጃም፣ አማራ ክልል። የአየር ጠባይ፡ ወይና ደጋ። የፓሲፊክ ውቅያኖስ ሙቀት፡ +1.5°C።",
        "output": "በከፍተኛ ኤል ኒኞ ወቅት የክረምት ዝናብ ሊዘገይ እና አጭር ድርቅ ሊከሰት ይችላል። በሲናን ወይና ደጋ አካባቢ መደበኛ የዝናብ ጅምር እስኪረጋገጥ ድረስ መጠበቅ ይመረጣል። መዝሪያው ከሰኔ መጨረሻ እስከ ሐምሌ አጋማሽ ተገቢ ነው። የውሃ እጥረትን የሚቋቋሙ እንደ ቁንጮ ወይም ቦሴት ዝርያዎችን ይጠቀሙ፤ እርጥበትን ለመጠበቅ እርከን እና ማልችንግ ይተግብሩ።",
        "language": "am",
        "category": "planting_window"
    },
    {
        "instruction": "በድርቅ ወቅት በስንዴ ማሳ ላይ የውሃ እና የአፈር እርጥበትን እንዴት መጠበቅ ይቻላል?",
        "input": "ሰብል፡ ስንዴ። የመሬት ሁኔታ፡ መካከለኛ ደረቅ። ስጋት፡ ከ12 ቀናት በላይ የዘለቀ የዝናብ መቋረጥ።",
        "output": "በማሳው ላይ ያለውን እርጥበት ለመጠበቅ የሰብል ተረፈ-ምርት (ሳር ወይም ገለባ) ማልች ያድርጉ። ከተቻለ ከውሃ ማቆሪያ ወይም ከምንጭ አነስተኛ ማጠጣት ያድርጉ። ዝናቡ እስኪመለስ ድረስ የዩሪያ ማዳበሪያ አይጨምሩ፣ ምክንያቱም በደረቅ አፈር ላይ ማዳበሪያ ሰብሉን ሊያቃጥል ይችላል።",
        "language": "am",
        "category": "water_management"
    },
    {
        "instruction": "በምሥራቅ ጎጃም ወይና ደጋ አካባቢ ለሚዘራ ጤፍ የተሻለው የተመረጠ ዘር የትኛው ነው?",
        "input": "ዞን፡ ወይና ደጋ (ከ1500 - 2500 ሜትር ከፍታ)። ዓላማ፡ ከፍተኛ ምርት እና የድርቅ መቋቋም።",
        "output": "በምሥራቅ ጎጃም ወይና ደጋ ለሆነ መሬት የኢትዮጵያ ግብርና ምርምር ኢንስቲትዩት (EIAR) ቁንጮ (DZ-Cr-37) ለጥሩ ዝናብ ወቅት፣ እና ቦሴት (DZ-Cr-409) ለአጭር ዝናብ ወይም እርጥበት አጠር ቦታዎች ይመክራል። በመስመር ሲዘራ በሄክታር ከ10-15 ኪ.ግ፣ በብተና ከሆነ ከ25-30 ኪ.ግ ዘር ይጠቀሙ።",
        "language": "am",
        "category": "seed_variety"
    },

    # Afaan Oromoo
    {
        "instruction": "Waqtii El Niinyoo (El Niño) olaanaa keessatti qonnaan bulaan teeffii yoom facaasuu qaba?",
        "input": "Midhaan: Xaafii (Qunxoo). Bakka: Baddaa-daree. Haala qilleensaa: Roobni harkifachuu danda'a.",
        "output": "Waqtii El Niinyoo olaanaatti roobni waqtii Kireemtii yeroo baayyee ni harkifata. Kanaafuu, facaasaan xaafoo hanga roobni sirriitti jalqabutti eeguun gaaridha (dhuma Waxabajjii hanga walakkaa Adoolessaatti). Sanyii filatamaa hongee danda'an kan akka Qunxoo ykn Boosat fayyadamaa. Dachee keessatti jiidha tursiisuuf daagaa hojjedhaa.",
        "language": "om",
        "category": "planting_window"
    },
    {
        "instruction": "Waqtii roobni citteetti qamadiif bishaan akkamitti eegama?",
        "input": "Midhaan: Qamadii. Haala biyyootti: Gogaa. Ragaa: Roobni guyyoota 12f citeera.",
        "output": "Jiidha biyyootti eeguuf baala ykn citaa qamadii jala kaayaa (mulching). Yoo carraan jallisii danda'ame bishaan xiqqoo kennaafii. Hanga roobni deebi'utti xaa'oo Yuuriyaa (Urea) hin dabaliinaa, gogiinsi osoo jiruu xaa'oo dabaluun midhaan guba.",
        "language": "om",
        "category": "water_management"
    },
    {
        "instruction": "Naannoo baddaa-dareetti sanyiin xaafii filatamaan isa kam?",
        "input": "Iddoo: Baddaa-daree (olka'iinsa meetira 1,500 - 2,500). Kaayyoo: Oomisha gaarii.",
        "output": "Naannoo baddaa-dareef EIAR sanyii Qunxoo (DZ-Cr-37) oomisha olaanaaf, akkasumas Boosat (DZ-Cr-409) lafa jiidha gahaa hin qabneef ni gorsa. Facaasaa sararaaf hektaaratti kg 10-15, bittinneessuuf immoo kg 25-30 fayyadamaa.",
        "language": "om",
        "category": "seed_variety"
    }
]

# Free online datasets reference manifest
OPEN_DATASETS_MANIFEST = {
    "huggingface_language_datasets": [
        {
            "id": "masakhane/afriqa",
            "description": "African Question Answering dataset with Amharic QA pairs",
            "url": "https://huggingface.co/datasets/masakhane/afriqa",
            "languages": ["amh"],
            "use_case": "Fine-tuning conversational advisory agent"
        },
        {
            "id": "castorini/afriberta",
            "description": "Multilingual language model & corpus for African languages including Amharic and Oromo",
            "url": "https://huggingface.co/castorini/afriberta",
            "languages": ["amh", "orm"],
            "use_case": "Base model and pretraining corpus"
        },
        {
            "id": "masakhane/lafand-mt",
            "description": "African translation benchmark covering Amharic and Oromo",
            "url": "https://huggingface.co/datasets/masakhane/lafand-mt",
            "languages": ["amh", "orm", "eng"],
            "use_case": "Multi-lingual advisory translation alignment"
        }
    ],
    "huggingface_speech_datasets": [
        {
            "id": "google/fleurs",
            "description": "102-language speech benchmark with Amharic (am_et) and Oromo (om_et)",
            "url": "https://huggingface.co/datasets/google/fleurs",
            "languages": ["am_et", "om_et"],
            "use_case": "Fine-tuning Whisper / MMS ASR & TTS for Hotline 977"
        },
        {
            "id": "mozilla-foundation/common_voice_17_0",
            "description": "Crowd-sourced open voice recordings with transcripts",
            "url": "https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0",
            "languages": ["am", "om"],
            "use_case": "Hotline acoustic model adaptation"
        }
    ],
    "crop_and_climate_datasets": [
        {
            "id": "aykgeh/Chokye_Water_Shield",
            "description": "Choke Mountain Watershed 1990-2023 crop yields & ENSO climate observations",
            "url": "https://huggingface.co/aykgeh/Chokye_Water_Shield",
            "crops": ["Teff", "Wheat", "Maize"],
            "use_case": "Crop yield prediction and drought vulnerability"
        },
        {
            "id": "WorldBank/LSMS-ISA-Ethiopia",
            "description": "Ethiopia Socioeconomic Survey (ESS Waves 1-5) plot-level agricultural microdata",
            "url": "https://microdata.worldbank.org/index.php/catalog/3823",
            "use_case": "Plot-level empirical yield, fertilizer, and seed response modeling"
        },
        {
            "id": "CHIRPS-EastAfrica",
            "description": "High-resolution (0.05 deg) rainfall for East Africa (1981-present)",
            "url": "https://data.chc.ucsb.edu/products/CHIRPS-2.0/",
            "use_case": "Drought severity and precipitation anomaly input"
        },
        {
            "id": "ISRIC-SoilGrids",
            "description": "Global 250m soil property maps (organic carbon, pH, texture)",
            "url": "https://www.isric.org/explore/soilgrids",
            "use_case": "Plot-level soil water retention and nutrient mapping"
        }
    ]
}


def build_finetune_dataset(output_dir: Path) -> dict[str, int]:
    """Build and write train/val JSONL files and manifest."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    train_path = output_dir / "farmer_advisory_train.jsonl"
    val_path = output_dir / "farmer_advisory_val.jsonl"
    manifest_path = output_dir / "open_datasets_manifest.json"
    
    # Simple 80/20 train/val split for demo seed corpus
    train_count = int(len(SEED_AGRONOMIC_CORPUS) * 0.8)
    train_data = SEED_AGRONOMIC_CORPUS[:train_count]
    val_data = SEED_AGRONOMIC_CORPUS[train_count:]
    
    with train_path.open("w", encoding="utf-8") as f:
        for item in train_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
            
    with val_path.open("w", encoding="utf-8") as f:
        for item in val_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
            
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(OPEN_DATASETS_MANIFEST, f, indent=2, ensure_ascii=False)
        
    log.info("Wrote %d train examples to %s", len(train_data), train_path)
    log.info("Wrote %d val examples to %s", len(val_data), val_path)
    log.info("Wrote open dataset catalog to %s", manifest_path)
    
    return {"train": len(train_data), "val": len(val_data)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare open agricultural data for fine-tuning")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "finetuning",
        help="Directory to save generated JSONL files",
    )
    args = parser.parse_args()
    build_finetune_dataset(args.output_dir)


if __name__ == "__main__":
    main()
