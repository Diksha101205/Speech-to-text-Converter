import argparse
import json
import os
import subprocess
import sys


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with local Whisper.")
    parser.add_argument("--audio", required=True, help="Path to the audio file.")
    parser.add_argument("--model", default="base", help="Whisper model name.")
    parser.add_argument("--language", default="", help="Optional language code, for example hi.")
    parser.add_argument("--task", default="transcribe", choices=["transcribe", "translate"])
    parser.add_argument("--prompt", default="", help="Optional transcription prompt.")
    args = parser.parse_args()

    try:
        import whisper
    except ModuleNotFoundError:
        fail(
            "Local Whisper is not installed. Run: .\\.venv\\Scripts\\python.exe -m pip install -U openai-whisper imageio-ffmpeg"
        )

    try:
        import imageio_ffmpeg

        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get(
            "PATH", ""
        )

        def run_with_bundled_ffmpeg(command, *run_args, **run_kwargs):
            if command and command[0] == "ffmpeg":
                command = [ffmpeg_path, *command[1:]]

            return subprocess.run(command, *run_args, **run_kwargs)

        whisper.audio.run = run_with_bundled_ffmpeg
    except ModuleNotFoundError:
        pass

    try:
        model = whisper.load_model(args.model)
        options = {
            "task": args.task,
            "fp16": False,
        }

        if args.language:
            options["language"] = args.language

        if args.prompt:
            options["initial_prompt"] = args.prompt

        result = model.transcribe(args.audio, **options)
        print(
            json.dumps(
                {
                    "text": result.get("text", "").strip(),
                    "language": result.get("language", args.language),
                    "model": args.model,
                },
                ensure_ascii=False,
            )
        )
    except Exception as error:
        fail(str(error))


if __name__ == "__main__":
    main()
