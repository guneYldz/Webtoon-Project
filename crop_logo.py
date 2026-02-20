from PIL import Image
import os

def crop_image(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        bbox = img.getbbox()
        if bbox:
            cropped_img = img.crop(bbox)
            cropped_img.save(output_path)
            print(f"✅ Image cropped successfully provided bbox: {bbox}")
        else:
            print("⚠️ No content found to crop (empty image?)")
    except Exception as e:
        print(f"❌ Error cropping image: {e}")

input_file = r"c:\Users\guney\Desktop\WebtoonBackend\frontend\public\logo_old.png"
output_file = r"c:\Users\guney\Desktop\WebtoonBackend\frontend\public\logo.png"

# Ensure we use the backup as source if valid, or the current logo
if not os.path.exists(input_file):
    # If backup doesn't exist (maybe copy failed?), try logo.png as source
    # But wait, if I read logo.png and write logo.png, it's risky if it fails mid-way.
    # I trust the copy command worked. Let's verify.
    if os.path.exists(r"c:\Users\guney\Desktop\WebtoonBackend\frontend\public\logo.png"):
         import shutil
         shutil.copy(r"c:\Users\guney\Desktop\WebtoonBackend\frontend\public\logo.png", input_file)

crop_image(input_file, output_file)
