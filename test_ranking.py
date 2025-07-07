#!/usr/bin/env python3
"""
Simple test to verify LibGen search ranking functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from libgen_api_enhanced import LibgenSearch
from searchAndSpeak import rank_search_results, similarity

def test_ranking():
    print("🧪 Testing LibGen Search Ranking")
    print("=" * 40)
    
    # Test similarity function
    print("\n📊 Testing similarity function:")
    test_pairs = [
        ("Python Programming", "Python"),
        ("Machine Learning", "machine learning"),
        ("Data Science", "data"),
        ("Introduction to Python", "Python")
    ]
    
    for text1, text2 in test_pairs:
        sim = similarity(text1, text2)
        print(f"  '{text1}' vs '{text2}': {sim:.3f}")
    
    # Test with actual LibGen search
    try:
        print("\n🔍 Testing LibGen search and ranking:")
        s = LibgenSearch()
        title_filters = {"Language": "English", "Extension": "pdf"}
        
        # Search for a common term
        results = s.search_title_filtered("Python", title_filters, exact_match=False)
        
        if results and len(results) > 0:
            print(f"📚 Found {len(results)} results")
            
            # Rank results
            ranked = rank_search_results("Python", results)
            
            print("\n🏆 Top 5 ranked results:")
            for i, book in enumerate(ranked[:5]):
                title = book.get('Title', 'Unknown')
                author = book.get('Author', 'Unknown')
                year = book.get('Year', 'Unknown')
                print(f"  {i+1}. {title[:60]}...")
                print(f"     Author: {author[:40]}... | Year: {year}")
        else:
            print("❌ No results found or empty results list")
            
    except Exception as e:
        print(f"❌ Search test failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n✅ Ranking test completed!")

if __name__ == "__main__":
    test_ranking()
