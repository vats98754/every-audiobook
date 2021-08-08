from gtts import gTTS
import PyPDF2
import os
import pathlib
from libgen_api import LibgenSearch
import urllib.request
from convert_to_iso import convert


def searchLibgen(title, lang):
    try:
        s = LibgenSearch()

        title_filters = {"Language": lang, "Extension": "pdf"}
        titles = s.search_title_filtered(title, title_filters, exact_match=True)

        item_to_download = titles[0]
        download_links = s.resolve_download_links(item_to_download)

        pdf_link = download_links['Cloudflare']

        def download_file(download_url, filename):
            response = urllib.request.urlopen(download_url)
            file = open(filename + ".pdf", 'wb')
            file.write(response.read())
            file.close()

        download_file(pdf_link, "PDF_Download")

        current_dir = str(pathlib.Path().resolve())

        path = current_dir + "/" + title.replace(" ", "_") + ".pdf"

        if not os.path.exists(path):
            os.makedirs(path)

        pdfFileObj = open(path, 'rb')

        pdfReader = PyPDF2.PdfFileReader(pdfFileObj)

        n = pdfReader.numPages

        langConverted = str(convert(1, lang))

        for i in range(n):
            pageObj = pdfReader.getPage(i)

            mytext = pageObj.extractText()

            language = langConverted

            myobj = gTTS(text="Here is page number %s." % (i+1) + mytext, lang=language, slow=False)

            myobj.save("currentpage.mp3")

            os.system("mpg321 currentpage.mp3")

        pdfFileObj.close()

    except IndexError:
        print('ERROR! Book not found!')

    except KeyError:
        print('ERROR! Language not found!')


title = input("Enter the title of the book you want to listen to: ")

lang = input("Enter the language that you want the book to be read in: ")

searchLibgen(title, lang)
