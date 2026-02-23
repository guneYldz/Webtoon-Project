from bot import AutoNovelBot

mock_novel = {
    'id': 999,
    'title': 'Shadow Slave',
    'url': 'https://novelight.net/book/shadow-slave-novel'
}

print("INIT BOT...")
bot = AutoNovelBot()
print("RUNNING PROCESS CHAPTER...")
bot.process_chapter(mock_novel, 2823, "https://novelight.net/book/shadow-slave-novel/chapter-289803")
