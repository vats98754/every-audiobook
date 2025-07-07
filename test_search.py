#!/usr/bin/env python3
"""
Test script to demonstrate the improved LibGen search functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from searchAndSpeak import search_and_select_book

def test_search():
    print("🧪 Testing improved LibGen search functionality")
    print("=" * 50)
    
    # Test search for a popular book
    test_queries = [
        ("Python", "English"),
        ("machine learning", "English"),
        ("data science", "English")
    ]
    
    for title, lang in test_queries:
        print(f"\n🔍 Testing search for: '{title}' in {lang}")
        print("-" * 30)
        
        try:
            # This will show the search results but we won't proceed with download
            result = search_and_select_book(title, lang)
            if result:
                print(f"✅ Search successful! Found book: {result.get('Title', 'Unknown')}")
            else:
                print("❌ No results or search cancelled")
        except Exception as e:
            print(f"❌ Search failed: {e}")
        
        print()

if __name__ == "__main__":
    test_search()
