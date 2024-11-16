#import time

# Record the start time
#start_time = time.time()

import sys
import torch
import torchaudio
from whisper_medusa import WhisperMedusaModel
from transformers import WhisperProcessor

# Clear the CUDA cache
torch.cuda.empty_cache()

# Load the model and processor
model_name = "aiola/whisper-medusa-v1"
model = WhisperMedusaModel.from_pretrained(model_name)
processor = WhisperProcessor.from_pretrained(model_name)

# Constants
SAMPLING_RATE = 16000
language = "en"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Check if audio file path is provided
if len(sys.argv) != 2:
    print("Usage: python go.py <audio_file_path>")
    sys.exit(1)

# Get the audio file path from command-line arguments
path_to_audio = sys.argv[1]

# Load the audio file
input_speech, sr = torchaudio.load(path_to_audio)

# If stereo, average the channels
if input_speech.shape[0] > 1:  # If stereo, average the channels
    input_speech = input_speech.mean(dim=0, keepdim=True)

if sr != SAMPLING_RATE:
    input_speech = torchaudio.transforms.Resample(sr, SAMPLING_RATE)(input_speech)

# Process the input features
input_features = processor(input_speech.squeeze(), return_tensors="pt", sampling_rate=SAMPLING_RATE).input_features
input_features = input_features.to(device)

# Move the model to the appropriate device
model = model.to(device)

# Generate the output
model_output = model.generate(
    input_features,
    language=language,
)
predict_ids = model_output[0]
pred = processor.decode(predict_ids, skip_special_tokens=True)

# Print the prediction
print(pred)

# Record the end time
#end_time = time.time()

# Calculate duration
#duration = end_time - start_time

# Print the total time in seconds
# print(f"Total time: {duration:.2f} seconds")