import undetected_chromedriver as uc
import time
import traceback

def test():
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    try:
        driver = uc.Chrome(options=options, version_main=147)
        print("Driver loaded")
        url = "https://manga-tr.com/manga-nan-hao-shang-feng.html"
        driver.get(url)
        time.sleep(5)
        
        print("Checking pagination...")
        # Check total pages calculation logic
        total_pages = driver.execute_script("""
            let max = 0;
            document.querySelectorAll('ul.pagination1 a, .pagination a, .page-link').forEach(a => {
                let dp = parseInt(a.getAttribute('data-page'));
                if (!isNaN(dp) && dp > max) max = dp;
                let txt = parseInt(a.textContent.trim());
                if (!isNaN(txt) && txt > max) max = txt;
            });
            return max > 0 ? max : 1;
        """)
        print(f"Total pages logic returned: {total_pages}")
        
        # Dump HTML of pagination to debug
        pagination_html = driver.execute_script("""
            let elems = document.querySelectorAll('ul.pagination1, .pagination, .page-link, [class*="pagination"]');
            let html = "";
            elems.forEach(e => html += e.outerHTML + "\\n");
            return html;
        """)
        print("Pagination HTML:")
        print(pagination_html)
        
        chapter_links = driver.execute_script("""
            let seen = new Set();
            let chapters = [];
            document.querySelectorAll('a[href]').forEach(a => {
                let href = a.href;
                let match = href.match(/id-\\d+-read-[\\w-]+-chapter-([\\d.]+)\\.html/);
                if (match && !seen.has(href)) {
                    seen.add(href);
                    chapters.push({ num: match[1], url: href });
                }
            });
            return chapters;
        """)
        print(f"Chapters found on first page: {len(chapter_links)}")
        
        # Test chapter image logic
        if chapter_links:
            chapter_url = chapter_links[0]['url']
            print(f"Going to chapter: {chapter_url}")
            driver.get(chapter_url)
            time.sleep(5)
            
            num_pages = driver.execute_script("return document.querySelectorAll('.chapter-page').length;")
            print(f"Num pages found: {num_pages}")
            
            if num_pages == 0:
                print("Dumping body html to see why no .chapter-page:")
                print(driver.page_source[:2000])
                
            else:
                canvas_test = driver.execute_script("""
                    try {
                        var c = document.querySelectorAll('.chapter-page')[0].querySelector('canvas');
                        var data = c.toDataURL('image/png');
                        return "Success: " + data.substring(0, 30);
                    } catch(e) {
                        return "Error: " + e.toString();
                    }
                """)
                print("Canvas test:")
                print(canvas_test)
        
    except Exception as e:
        traceback.print_exc()
    finally:
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    test()
