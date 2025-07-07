from gtts import gTTS
import PyPDF2
import os
import pathlib
from libgen_api import LibgenSearch
import urllib.request
from convert_to_iso import convert
import pygame
import re
from difflib import SequenceMatcher


def similarity(a, b):
    """Calculate similarity between two strings"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def rank_search_results(search_term, results):
    """Rank search results by relevance"""
    ranked_results = []
    
    for book in results:
        title = book.get('Title', '').strip()
        author = book.get('Author', '').strip()
        year = book.get('Year', '')
        pages = book.get('Pages', '0')
        
        # Calculate relevance score
        title_similarity = similarity(search_term, title)
        
        # Bonus points for exact matches in title
        if search_term.lower() in title.lower():
            title_similarity += 0.3
            
        # Bonus for author match if search term contains author info
        author_similarity = 0
        if author and len(search_term.split()) > 1:
            author_similarity = similarity(search_term, author) * 0.2
            
        # Prefer newer books (small bonus)
        year_bonus = 0
        try:
            if year and year.isdigit():
                year_int = int(year)
                if year_int >= 2000:
                    year_bonus = 0.1
                elif year_int >= 1990:
                    year_bonus = 0.05
        except:
            pass
            
        # Prefer books with reasonable page counts
        page_bonus = 0
        try:
            if pages and pages.isdigit():
                page_count = int(pages)
                if 50 <= page_count <= 1000:  # Reasonable book length
                    page_bonus = 0.1
        except:
            pass
            
        total_score = title_similarity + author_similarity + year_bonus + page_bonus
        
        ranked_results.append({
            'book': book,
            'score': total_score,
            'title': title,
            'author': author,
            'year': year,
            'pages': pages
        })
    
    # Sort by score descending
    ranked_results.sort(key=lambda x: x['score'], reverse=True)
    return ranked_results


def search_and_select_book(title, lang):
    """Search for books and let user select the best match"""
    try:
        print(f"\n🔍 Searching for '{title}' in {lang}...")
        
        s = LibgenSearch()
        title_filters = {"Language": lang, "Extension": "pdf"}
        
        # Try exact match first
        results = s.search_title_filtered(title, title_filters, exact_match=True)
        
        # If no exact matches, try broader search
        if not results:
            print("No exact matches found. Searching with broader criteria...")
            results = s.search_title_filtered(title, title_filters, exact_match=False)
        
        if not results:
            print("❌ No books found! Try a different search term or language.")
            return None
            
        # Rank results by relevance
        ranked_results = rank_search_results(title, results)
        
        print(f"\n📚 Found {len(ranked_results)} books. Here are the best matches:\n")
        
        # Show top 10 results
        display_count = min(10, len(ranked_results))
        
        for i in range(display_count):
            result = ranked_results[i]
            book = result['book']
            score = result['score']
            
            print(f"{i+1}. 📖 {result['title']}")
            print(f"   👤 Author: {result['author']}")
            print(f"   📅 Year: {result['year']} | 📄 Pages: {result['pages']}")
            print(f"   🎯 Relevance: {score:.2f}")
            print(f"   💾 Size: {book.get('Size', 'Unknown')}")
            print()
        
        # Let user select
        while True:
            try:
                choice = input(f"Select a book (1-{display_count}) or 'q' to quit: ").strip()
                
                if choice.lower() == 'q':
                    print("Search cancelled.")
                    return None
                    
                choice_num = int(choice)
                if 1 <= choice_num <= display_count:
                    selected = ranked_results[choice_num - 1]['book']
                    print(f"✅ Selected: {ranked_results[choice_num - 1]['title']}")
                    return selected
                else:
                    print(f"Please enter a number between 1 and {display_count}")
                    
            except ValueError:
                print("Please enter a valid number or 'q' to quit")
        
    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        return None


def searchLibgen(title, lang):
    try:
        # Use the new search and select function
        item_to_download = search_and_select_book(title, lang)
        
        if not item_to_download:
            return
            
        print(f"\n⬬ Downloading book...")
        
        s = LibgenSearch()
        download_links = s.resolve_download_links(item_to_download)

        # Try different download mirrors
        pdf_link = None
        for mirror in ['Cloudflare', 'IPFS.io', 'Infura']:
            if mirror in download_links:
                pdf_link = download_links[mirror]
                print(f"Using {mirror} mirror for download...")
                break

        if not pdf_link:
            print("❌ No download links available!")
            return

        def download_file(download_url, filename):
            print(f"📥 Downloading to {filename}.pdf...")
            response = urllib.request.urlopen(download_url)
            file = open(filename + ".pdf", 'wb')
            file.write(response.read())
            file.close()
            print("✅ Download complete!")

        download_file(pdf_link, "PDF_Download")

        current_dir = str(pathlib.Path().resolve())
        pdf_path = current_dir + "/PDF_Download.pdf"
        
        print(f"\n🔊 Converting to audiobook...")
        
        pdfFileObj = open(pdf_path, 'rb')
        pdfReader = PyPDF2.PdfReader(pdfFileObj)
        n = len(pdfReader.pages)
        
        print(f"📄 Processing {n} pages...")

        langConverted = str(convert(1, lang))

        for i in range(n):
            print(f"🔉 Reading page {i+1}/{n}...")
            
            pageObj = pdfReader.pages[i]
            mytext = pageObj.extract_text()

            language = langConverted

            myobj = gTTS(text="Here is page number %s." % (i+1) + mytext, lang=language, slow=False)
            myobj.save("currentpage.mp3")

            # Use pygame for cross-platform audio playback instead of mpg321
            pygame.mixer.init()
            pygame.mixer.music.load("currentpage.mp3")
            pygame.mixer.music.play()
            
            # Wait for the audio to finish playing
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)

        pdfFileObj.close()
        print("\n🎉 Audiobook conversion complete!")

    except IndexError:
        print('❌ ERROR! Book not found!')

    except KeyError:
        print('❌ ERROR! Language not found!')

    except Exception as e:
        print(f'❌ ERROR! {str(e)}')


if __name__ == "__main__":
    print("🎧 AudioGen - Convert Books to Audiobooks")
    print("=" * 40)
    
    title = input("📚 Enter the title of the book you want to listen to: ")
    lang = input("🌍 Enter the language that you want the book to be read in: ")
    
    searchLibgen(title, lang)
