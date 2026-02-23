import os
import shutil
from sqlalchemy import create_engine, text
from PIL import Image, ImageDraw, ImageFont

# Connect to DB
DATABASE_URL = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"
engine = create_engine(DATABASE_URL)

def create_placeholder(path, text_content="MISSING", width=800, height=1200, color=(50, 50, 50)):
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        img = Image.new('RGB', (width, height), color=color)
        d = ImageDraw.Draw(img)
        
        # Try to load a font, fallback to default
        try:
            # On Windows, arial might be available
            font = ImageFont.truetype("arial.ttf", 60)
        except:
            font = ImageFont.load_default()
            
        # Draw text (centered-ish)
        # Using simple centering as getsize is deprecated in newer Pillows, 
        # but for safety we'll just draw at a fixed position or try basic centering
        try:
             bbox = d.textbbox((0, 0), text_content, font=font)
             w = bbox[2] - bbox[0]
             h = bbox[3] - bbox[1]
             d.text(((width-w)/2, (height-h)/2), text_content, fill=(200, 200, 200), font=font)
        except:
             d.text((50, height/2), text_content, fill=(200, 200, 200))
             
        img.save(path)
        print(f"   ✅ Created placeholder: {path}")
        return True
    except Exception as e:
        print(f"   ❌ Failed to create placeholder {path}: {e}")
        return False

def fix_images():
    print("--- FIXING MISSING IMAGES ---")
    
    with engine.connect() as conn:
        # 1. FIX BANNER / COVER for Webtoon #1
        row = conn.execute(text("SELECT id, title, cover_image, banner_image FROM webtoons WHERE id=1")).fetchone()
        if row:
            webtoon_id, title, cover_rel, banner_rel = row
            print(f"Checking Webtoon: {title}")
            
            # Paths (Assuming run from Backend/)
            cover_path = os.path.abspath(cover_rel) if cover_rel else None
            banner_path = os.path.abspath(banner_rel) if banner_rel else None
            
            cover_exists = cover_path and os.path.exists(cover_path)
            banner_exists = banner_path and os.path.exists(banner_path)
            
            # A. Fix Cover if missing
            if cover_rel and not cover_exists:
                print(f"   ⚠️ Cover missing: {cover_rel}")
                create_placeholder(cover_path, "COVER MISSING", 600, 900, (100, 0, 0))
                cover_exists = True # Now it exists
            
            # B. Fix Banner (Slider issue)
            if banner_rel:
                if not banner_exists:
                    print(f"   ⚠️ Banner missing: {banner_rel}")
                    # Strategy: Try to copy cover to banner if cover exists
                    if cover_exists:
                        try:
                            shutil.copy2(cover_path, banner_path)
                            print(f"   ✅ Copied cover to banner: {banner_path}")
                        except Exception as e:
                            print(f"   ❌ Copy failed: {e}")
                            create_placeholder(banner_path, f"{title} BANNER", 1200, 400, (0, 0, 100))
                    else:
                        create_placeholder(banner_path, f"{title} BANNER", 1200, 400, (0, 0, 100))
            else:
                 print("   ℹ️ No banner defined in DB.")
                 
        
        # 2. FIX EPISODE IMAGES for Episode #1
        print("\nChecking Episode 1 Images...")
        imgs = conn.execute(text("SELECT id, image_url, page_order FROM episode_images WHERE episode_id=1 ORDER BY page_order")).fetchall()
        
        for img_row in imgs:
            img_id, img_rel, order = img_row
            img_path = os.path.abspath(img_rel)
            
            if not os.path.exists(img_path):
                print(f"   ⚠️ Missing Page {order}: {img_rel}")
                create_placeholder(img_path, f"PAGE {order}\nMISSING", 800, 1200, (30, 30, 30))
            else:
                # print(f"   OK Page {order}")
                pass

if __name__ == "__main__":
    fix_images()
