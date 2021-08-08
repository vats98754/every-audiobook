import tkinter as tk
import tkinter.ttk as ttk
from tkinter import scrolledtext
from gtts import gTTS
import PyPDF2
import pathlib
from libgen_api import LibgenSearch
import urllib.request
from convert_to_iso import convert
import pygame


root = tk.Tk()
main_window = ttk.Frame(root)
mainwindow = main_window

# Creating a custom style/theme for the whole app
mygreen = "#3ded97"
myred = "#e3242b"

style = ttk.Style()
style.theme_create("colorful", parent="alt", settings={
	"TFrame": {"configure": {"background": "#000000"}},
	"TLabel": {"configure": {"background": "#000000", "foreground": "#3ded97"}},
	"TNotebook": {"configure": {"tabmargins": [2, 5, 2, 0], "background": "#000000"}},
	"TNotebook.Tab": {
		"configure": {"padding": [5, 1], "background": mygreen},
		"map":       {"background": [("selected", myred)],
		              "expand": [("selected", [1, 1, 1, 0])]}},
	"TButton": {"configure": {"background": "#2c2c2c", "foreground": "#3ded97", "anchor": "center"}}})

style.theme_use("colorful")

pygame.init()
pygame.mixer.init()

global pause
pause = False
global volume
volume = 1.0
global speed
speed = 1.0
global page
page = 1
global title
global lang
global pdfFileObj
global pdfReader
global n
n = 0

def playAudio(initialPage):
	global n
	n = pdfReader.numPages

	langConverted = str(convert(1, lang))

	if initialPage > n:
		initialPage = n
	elif initialPage < 1:
		initialPage = 1

	global page
	page = initialPage
	i = initialPage - 1

	while i < n and not pygame.mixer.music.get_busy():
		pageObj = pdfReader.getPage(i)

		page = i + 1

		mytext = pageObj.extractText()

		language = langConverted

		current_dir = str(pathlib.Path().resolve())

		current_page_address = current_dir + "/currentpage.mp3"

		myobj = gTTS(text="Here is page number %s." % (i+1) + mytext, lang=language, slow=False)

		myobj.save(current_page_address)

		pygame.mixer.music.load(current_page_address)

		pygame.mixer.music.play()


def searchBook():
	try:
		global title
		title = str(entryTitle.get())
		global lang
		lang = str(entryLang.get())

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

		global pdfFileObj
		pdfFileObj = open(current_dir + "/PDF_Download.pdf", 'rb')

		global pdfReader
		pdfReader = PyPDF2.PdfFileReader(pdfFileObj)

		lblError.configure(text='')
		main_notebook.tab(0, state='hidden')
		main_notebook.tab(1, state='normal')

		lblBookName.configure(state='normal')
		lblBookName.insert('0.0', "Now reading: \n" + title)
		lblBookName.configure(state='disabled')

		playAudio(0)

	except IndexError:
		lblError.configure(text='ERROR! Book not found!')
	except KeyError:
		lblError.configure(text='ERROR! Language not found!')

# build ui
main_notebook = ttk.Notebook(main_window)

inputFrame = ttk.Frame(main_notebook)

maintitle = ttk.Label(inputFrame)
maintitle.configure(font='{a} 24 {bold italic}', justify='center', text='Every-Audiobook')
maintitle.grid(column='0', pady='20', row='0')

entryTitle = ttk.Entry(inputFrame)
entryTitle.configure(justify='center')
entryTitle.grid(column='0', pady='5', row='2')

lbl_lang = ttk.Label(inputFrame)
lbl_lang.configure(justify='center', text='Enter the audio language:')
lbl_lang.grid(column='0', pady='10', row='3')

entryLang = ttk.Entry(inputFrame)
entryLang.configure(justify='center')
entryLang.grid(column='0', pady='5', row='4')

lblError = ttk.Label(inputFrame)
lblError.configure(foreground='#ff2600', justify='center', text='')
lblError.grid(column='0', row='6')

btnSubmit = ttk.Button(inputFrame, command=searchBook)
btnSubmit.configure(text='Submit')
btnSubmit.grid(column='0', pady='20', row='5')

lblTitle = ttk.Label(inputFrame)
lblTitle.configure(text='Enter the title of the book:')
lblTitle.grid(column='0', pady='10', row='1')

inputFrame.configure(height='300', width='300')
inputFrame.grid(column='0', row='0')
main_notebook.add(inputFrame, compound='center', state='normal', sticky='n', text='Entry')

controlFrame = ttk.Frame(main_notebook)

def pauseplay(is_paused):
	global pause
	pause = is_paused
	if pause:
		pygame.mixer.music.unpause()
		btnPausePlay.configure(text='⏸️', width='5')
		pause = False
	else:
		pygame.mixer.music.pause()
		btnPausePlay.configure(text='▶️', width='5')
		pause = True


btnPausePlay = ttk.Button(controlFrame, command=lambda: pauseplay(pause))
btnPausePlay.configure(text='⏸️', width='5')
btnPausePlay.grid(column='1', row='1')

def prevPage():
	stopBook()
	global page
	page -= 1
	if page < 1:
		page = 1
	lblPage.configure(text='Page: ' + str(page))
	playAudio(page)

btnPrevPage = ttk.Button(controlFrame, command=prevPage)
btnPrevPage.configure(text='Prev', width='3')
btnPrevPage.grid(column='0', pady='10', row='3')


def nextPage():
	stopBook()
	global page
	page += 1
	global n
	if page > n:
		page = n
	lblPage.configure(text='Page: ' + str(page))
	playAudio(page)


btnNextPage = ttk.Button(controlFrame, command=nextPage)
btnNextPage.configure(text='Next', width='3')
btnNextPage.grid(column='2', row='3')


def volDown():
	current_vol = pygame.mixer.music.get_volume()
	current_vol -= 0.1

	if current_vol < 0.1:
		pygame.mixer.music.set_volume(0)
	else:
		pygame.mixer.music.set_volume(current_vol)

	volume = pygame.mixer.music.get_volume()
	lblVol.configure(text='Volume: ' + str(volume))


btnVolumeDown = ttk.Button(controlFrame, command=volDown)
btnVolumeDown.configure(text='➖', width='3')
btnVolumeDown.grid(column='0', pady='10', row='2')


def volUp():
	current_vol = pygame.mixer.music.get_volume()
	current_vol += 0.1

	if current_vol > 0.9:
		pygame.mixer.music.set_volume(1.0)
	else:
		pygame.mixer.music.set_volume(current_vol)

	volume = pygame.mixer.music.get_volume()
	lblVol.configure(text='Volume: ' + str(volume))


btnVolumeUp = ttk.Button(controlFrame, command=volUp)
btnVolumeUp.configure(text='➕', width='3')
btnVolumeUp.grid(column='2', row='2')

lblVol = ttk.Label(controlFrame)
lblVol.configure(text='Volume: ' + str(volume))
lblVol.grid(column='1', row='2')

lblBookName = scrolledtext.ScrolledText(controlFrame)
lblBookName.configure(font='{2} 12 {}', height='1', state='disabled', width='20')
lblBookName.configure(state='disabled')
lblBookName.grid(column='1', pady='10', row='0')

lblPage = ttk.Label(controlFrame)
lblPage.configure(text='Page: ' + str(page))
lblPage.grid(column='1', row='3')


def stopBook():
	global title
	title = ''
	pygame.mixer.music.stop()


btnStop = ttk.Button(controlFrame, command=stopBook)
btnStop.configure(text='⏹️', width='3')
btnStop.grid(column='2', row='1')

lblSpeed = ttk.Label(controlFrame)
lblSpeed.configure(text='Speed: ' + str(speed) + 'x')
lblSpeed.grid(column='1', row='4')

def speedUp():
	return
	# global speed
	# if speed > 3.0:
	# 	speed = 3.0
	# else:
	# 	speed += 0.125
	# speed_change(currentpage, speed)

btnSpeedUp = ttk.Button(controlFrame, command=speedUp)
btnSpeedUp.configure(text='⏫', width='3')
btnSpeedUp.grid(column='2', row='4')

def speedDown():
	return
	# global speed
	# if speed < 0.0:
	# 	speed = 0.0
	# else:
	# 	speed -= 0.125
	# speed_change(currentpage, speed)


btnSpeedDown = ttk.Button(controlFrame, command=speedDown)
btnSpeedDown.configure(text='⏬', width='3')
btnSpeedDown.grid(column='0', pady='10', row='4')

def exit():
	stopBook()
	main_notebook.tab(0, state='normal')
	main_notebook.tab(1, state='hidden')

btnExit = ttk.Button(controlFrame, command=exit)
btnExit.configure(text='❌', width='3')
btnExit.grid(column='0', row='1')

controlFrame.configure(height='300', width='300')
controlFrame.grid(column='0', row='0')
main_notebook.add(controlFrame, compound='center', state='normal', sticky='n', text='Controls')

main_notebook.configure(height='300', width='300')
main_notebook.grid(column='0', row='0')

main_window.configure(height='300', width='300')
main_window.grid(column='0', row='0')

# Default tab states
main_notebook.tab(0, state='normal')
main_notebook.tab(1, state='hidden')

mainwindow.mainloop()
