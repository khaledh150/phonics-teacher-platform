"""
Generate word/sentence VO files using ElevenLabs Cherry Twinkle voice.
Usage:
  python tools/generate_word_vo.py --input tools/words_to_record.csv --output public/sounds/vo-words/
  python tools/generate_word_vo.py --input tools/sentences_to_record.csv --output public/sounds/vo-sentences/
"""
import os
import csv
import re
import sys
import argparse
from elevenlabs.client import ElevenLabs

API_KEY = os.environ.get("ELEVENLABS_API_KEY")
if not API_KEY:
    sys.exit("ELEVENLABS_API_KEY environment variable required")
VOICE_ID = "XJ2fW4ybq7HouelYYGcL"  # Cherry Twinkle
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_32"

client = ElevenLabs(api_key=API_KEY)

_STRIP_PUNCT_RE = re.compile(r"[!?.,;:\"@#$%^&*+=<>{}\[\]/\\|`~]")

def _clean_for_tts(text):
    cleaned = _STRIP_PUNCT_RE.sub("", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def generate_audio(text, save_path):
    if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
        print(f"  SKIP (exists): {os.path.basename(save_path)}")
        return True

    tts_text = _clean_for_tts(text)
    if tts_text != text:
        print(f"  Cleaned: [{text}] -> [{tts_text}]")

    try:
        audio = client.text_to_speech.convert(
            text=tts_text,
            voice_id=VOICE_ID,
            model_id=MODEL_ID,
            output_format=OUTPUT_FORMAT,
        )
        with open(save_path, "wb") as f:
            for chunk in audio:
                if chunk:
                    f.write(chunk)
        size_kb = os.path.getsize(save_path) / 1024
        print(f"  OK ({size_kb:.1f}KB): {os.path.basename(save_path)}")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate VO with ElevenLabs Cherry Twinkle")
    parser.add_argument("--input", required=True, help="CSV file (filename,text)")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be recorded")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    with open(args.input, mode="r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        rows = list(reader)

    total = len(rows)
    success = 0
    skipped = 0
    failed = 0

    print(f"\n{'='*60}")
    print(f"ElevenLabs VO Generation — Cherry Twinkle / eleven_v3")
    print(f"Format: {OUTPUT_FORMAT}")
    print(f"Input: {args.input} ({total} items)")
    print(f"Output: {args.output}")
    print(f"{'='*60}\n")

    for i, row in enumerate(rows):
        if not row or len(row) < 2:
            continue

        filename = row[0]
        text = row[1]
        save_path = os.path.join(args.output, filename)

        print(f"[{i+1}/{total}] {text}")

        if args.dry_run:
            if os.path.exists(save_path):
                print(f"  WOULD SKIP (exists)")
                skipped += 1
            else:
                print(f"  WOULD GENERATE -> {filename}")
                success += 1
            continue

        if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
            skipped += 1
            print(f"  SKIP (exists): {filename}")
            continue

        if generate_audio(text, save_path):
            success += 1
        else:
            failed += 1

    print(f"\n{'='*60}")
    print(f"Done! Generated: {success}, Skipped: {skipped}, Failed: {failed}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
