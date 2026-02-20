from bot import AutoNovelBot
import time

mock_novel = {
    'id': 888,
    'title': 'Ghost Story',
    'url': 'https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work'
}

print("INIT BOT...")
bot = AutoNovelBot()
print("RUNNING PROCESS CHAPTER...")
# Use a real chapter URL
try:
    bot.process_chapter(mock_novel, 11, "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapter-11")
except Exception as e:
    print(f"Error: {e}")
finally:
    with open("lnp_debug_failed.html", "w", encoding="utf-8") as f:
        f.write(bot.driver.page_source)
    print("Dumped lnp_debug_failed.html")
    bot.driver.quit()
