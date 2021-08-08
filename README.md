# every-audiobook

**Description**

This is a GUI-based application built from Tkinter and uses the gTTS and pygame (mixer) libraries in conjunction with the libgen-api library to find almost any book and convert it to an audiobook that you can listen to. 
The GUI itself has the following features:
- pause/play, 
- stop (stops the entire book), 
- next/previous page, 
- volume up/down (this increases/decreases the volume of the audio itself, not of the system on which the audio is being played), 
- an exit button to start listening to another audiobook, 
- a speed up/down button (this is in construction, because I couldn't find a solution online for speeding up an audio file, even with formulae on the sampling rate, in real-time).


**Run Instructions**

Just run the audiobook_gui.py file to start the GUI. The convert_to_iso.py file is a general python dictionary file that I plan to upload to PyPI because it solves
a problem I haven't seen solved elsewhere - it takes a language (e.g. Spanish) and converts it to its ISO-639 equivalent (in four different forms: ISO-639-1,
ISO-639-2T, ISO-639-2B, and ISO-639-3). I scraped an excel sheet from an official source (the code is commented at the top of the aforementioned file) in order
to create dictionaries that store this information. Ultimately, the convert(type, lang) function was used for the text-to-speech constructor (from audiobook_gui.py, line 56, in line 80, for the gTTS constructor).

As for the searchAndSpeak.py file, it is a demo of the core of all the GUI code that allows you to type in the title and language of a book and convert it into
an audiobook of that language. It doesn't have all the additional features that comes with the GUI.


**Motive**

I created this to be able to help the average audiobook consumer, who wants to listen to books because reading them strains their eyes or doing so saves them valuable time, and mainly because **all the paid options for audiobooks (like Audible) are too expensive for what they offer, and their collections are certainly not as big as Libgenisis'.**
In any case, I do want to develop this GUI further to be able to have multiple books you can add in a list that allows you to pick and choose immediately which book you want to listen to, but I just didn't have enough time due to the time limit on the Hackathon. I plan to do implement these changes after the Hackathon finishes.
