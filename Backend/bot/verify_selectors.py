import time
from bot import AutoNovelBot

# Mock Novel Object
mock_novel_novelight = {
    'id': 999,
    'title': 'Shadow Slave',
    'url': 'https://novelight.net/book/shadow-slave-novel'
}

mock_novel_lnp = {
    'id': 888,
    'title': 'Ghost Story',
    'url': 'https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work'
}

def test_bot_logic():
    print("🤖 Initializing Bot...")
    
    try:
        bot = AutoNovelBot() 
        print("✅ Bot initialized.")
    except Exception as e:
        print(f"❌ Bot init failed: {e}")
        return

    print("\n" + "="*50)
    print("TEST 1: Novelight (API Method)")
    print("="*50)
    try:
        # 289803 is the chapter ID we found
        bot.process_chapter(mock_novel_novelight, 2823, "https://novelight.net/book/shadow-slave-novel/chapter-289803")
    except Exception as e:
        print(f"❌ Novelight Test Failed: {e}")

    print("\n" + "="*50)
    print("TEST 2: LightNovelPub (Selenium Fallback)")
    print("="*50)
    try:
        bot.process_chapter(mock_novel_lnp, 11, "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapter-11")
    except Exception as e:
        print(f"❌ LightNovelPub Test Failed: {e}")

    print("\nTesting Complete.")
    bot.driver.quit()

if __name__ == "__main__":
    with open("verification_result.txt", "w", encoding="utf-8") as f:
        f.write("Starting Verification...\n")

    original_print = print
    def log(*args, **kwargs):
        msg = " ".join(map(str, args))
        original_print(msg)
        with open("verification_result.txt", "a", encoding="utf-8") as f:
            try:
                f.write(msg + "\n")
            except:
                pass
    print = log

    test_bot_logic()
