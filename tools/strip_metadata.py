"""
Strip metadata and normalize all VO audio to 32kbps mono 44.1kHz.
Requires ffmpeg in PATH.

Usage:
  python tools/strip_metadata.py
"""
import os
import subprocess
import sys
import tempfile

AUDIO_DIRS = [
    "public/sounds/vo",
    "public/sounds/vo-letters",
    "public/sounds/vo-words",
    "public/sounds/vo-sentences",
]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def strip_file(filepath):
    tmp = filepath + ".tmp.mp3"
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", filepath,
                "-b:a", "32k", "-ar", "44100", "-ac", "1",
                "-map_metadata", "-1",
                tmp,
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr[:200]}")
            if os.path.exists(tmp):
                os.remove(tmp)
            return False

        old_size = os.path.getsize(filepath)
        new_size = os.path.getsize(tmp)
        os.replace(tmp, filepath)
        print(f"  {old_size/1024:.1f}KB -> {new_size/1024:.1f}KB")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        if os.path.exists(tmp):
            os.remove(tmp)
        return False

def main():
    total = 0
    processed = 0
    failed = 0

    for rel_dir in AUDIO_DIRS:
        abs_dir = os.path.join(BASE_DIR, rel_dir)
        if not os.path.isdir(abs_dir):
            print(f"Skipping (not found): {rel_dir}")
            continue

        files = [f for f in os.listdir(abs_dir) if f.lower().endswith(".mp3")]
        print(f"\n{'='*60}")
        print(f"{rel_dir}: {len(files)} files")
        print(f"{'='*60}")

        for f in sorted(files):
            total += 1
            filepath = os.path.join(abs_dir, f)
            print(f"[{total}] {f}")
            if strip_file(filepath):
                processed += 1
            else:
                failed += 1

    print(f"\n{'='*60}")
    print(f"Done! Processed: {processed}, Failed: {failed}, Total: {total}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
