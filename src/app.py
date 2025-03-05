#!/usr/bin/python3.10
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify, Response
from io import BytesIO
from newspaper import Article
from bs4 import BeautifulSoup
import anthropic
import requests
import json
import os
from datetime import datetime
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='public', template_folder='views')
app.secret_key = os.environ.get('SECRET', 'fallback-dev-secret-key')

# Constants
BASE_DIR = Path(__file__).resolve().parent
SITE_JSON_PATH = BASE_DIR / "public" / "site.json"
NEWS_SOURCE_URL = 'https://apnews.com/oddities'
API_KEY = os.environ.get('NEW_STORY_KEY', 'dev-key')

@app.route('/proxy-image', methods=['GET'])
def proxy_image():
    """
    Proxy for external images to avoid CORS issues with SmartCrop.js
    @author SanoKei
    """
    try:
        # Get the image URL from the query parameter
        image_url = request.args.get('url')
        
        if not image_url:
            return "Missing 'url' parameter", 400
            
        # Log the request (optional)
        logger.info(f"Proxying image: {image_url}")
        
        # Set up headers to appear as a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        
        # Request the image
        response = requests.get(image_url, headers=headers, stream=True)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        
        # Create a Flask Response with the same content and content type
        proxied_response = Response(
            response=BytesIO(response.content).read(),
            status=response.status_code
        )
        
        # Copy the content type
        if 'Content-Type' in response.headers:
            proxied_response.headers['Content-Type'] = response.headers['Content-Type']
        else:
            # Default to image/jpeg if no content type provided
            proxied_response.headers['Content-Type'] = 'image/jpeg'
        
        # Set CORS headers to allow access from any origin
        proxied_response.headers['Access-Control-Allow-Origin'] = '*'
        
        # Set caching headers (optional)
        proxied_response.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 1 day
        
        return proxied_response
        
    except Exception as e:
        logger.error(f"Image proxy error: {str(e)}")
        return f"Error proxying image: {str(e)}", 500

def fetch_news_articles(num_articles=13):
    """Fetch news articles from the source URL."""
    logger.info(f"Fetching articles from {NEWS_SOURCE_URL}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
    
    try:
        response = requests.get(NEWS_SOURCE_URL, headers=headers)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        
        soup = BeautifulSoup(response.content, 'html.parser')
        article_links = []
        
        # Find article links in the main content
        headlines = soup.find('main').find_all('bsp-custom-headline')
        for link in headlines[:num_articles]:
            a_tag = link.find('a', class_="Link")
            if a_tag and a_tag.get('href'):
                article_links.append(a_tag.get('href'))
        
        # Download and parse the articles
        articles = []
        for link in article_links:
            try:
                article = Article(link)
                article.download()
                article.parse()
                articles.append(article)
            except Exception as e:
                logger.error(f"Error parsing article {link}: {e}")
        
        logger.info(f"Successfully fetched {len(articles)} articles")
        return articles
    
    except Exception as e:
        logger.error(f"Error fetching news articles: {e}")
        return []

def prepare_article_summaries(articles):
    """Prepare article summaries for the AI prompt."""
    if not articles:
        return None
    
    # Create a single prompt with all articles
    summaries = []
    for i, article in enumerate(articles[:12]):  # Limit to first 12 articles
        key = get_article_key(i)
        summary = f"{key}: {article.text.split('—', 1)[1].strip() if '—' in article.text else article.text[:400]}"
        summaries.append(summary)
    
    return "\n".join(summaries)

def get_article_key(index):
    """Map article index to the corresponding key in the JSON template."""
    keys = [
        "firststory", "secondstory", "thirdstory", 
        "firstsubstory", "secondsubstory", "thirdsubstory",
        "fourthsubstory", "fifthsubstory", "sixthsubstory", 
        "seventhsubstory", "eighthsubstory"
    ]
    return keys[index] if index < len(keys) else f"story{index}"

def generate_wizard_stories(article_summaries):
    """Generate wizard-themed stories using Claude API."""
    if not article_summaries:
        return None
    
    logger.info("Generating wizard stories with Claude")
    
    # Create the system prompt
    system_prompt = """
    Generate a JSON object with humorous, imaginative wizard-themed explanations for real-world news events.
    
    Guidelines:
    - Attribute each real-world event to bizarre wizard/witch activities or magical mishaps
    - Make wizards operate in a separate reality that accidentally affects our world
    - People in the stories should be ordinary humans affected by wizard shenanigans
    - Create creative, clickbait-style titles with wizard themes
    - Articles must be at least 100 words
    - First story needs a caption (10 words or less)
    - Ensure the JSON is valid with proper escaping of quotes and special characters
    - Do not use \\n nor \\\" nor other housekeeping formating
    
    The response must be ONLY valid JSON matching this structure:
    {
        "firststory":
        {
            "title":"",
            "article":"",
            "caption":""
        },
        "secondstory":
        {
            "title":"",
            "article":""
        },
        "thirdstory":
        {
            "title":"",
            "article":""
        },
        "firstsubstory":
        {
            "title":"",
            "article":""
        },
        "secondsubstory":
        {
            "title":"",
            "article":""
        },
        "thirdsubstory":
        {
            "title":"",
            "article":""
        },
        "fourthsubstory":
        {
            "title":"",
            "article":""
        },
        "fifthsubstory":
        {
            "title":"",
            "article":""
        },
        "sixthsubstory":
        {
            "title":"",
            "article":""
        },
        "seventhsubstory":
        {
            "title":"",
            "article":""
        },
        "eighthsubstory":
        {
            "title":"",
            "article":""
        }
    }
    
    Return only the JSON object with no additional text, comments, or explanations.
    """
    
    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4096,
            temperature=0.75,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": article_summaries
                }
            ]
        )
        
        # Extract the response text
        json_text = response.content[0].text
        
        # Debug logging
        logger.info(f"Claude response length: {len(json_text)}")
        logger.info(f"First 100 chars of response: {json_text[:100] if json_text else 'Empty response'}")
        
        # Strip any markdown formatting
        json_text = json_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        
        # Extract just the JSON part
        start_idx = json_text.find('{')
        end_idx = json_text.rfind('}') + 1
        
        if start_idx >= 0 and end_idx > start_idx:
            json_text = json_text[start_idx:end_idx]
        
        # Try to parse the JSON with json_repair
        try:
            from json_repair import repair_json
            repaired_json = repair_json(json_text)
            repaired_json = repaired_json.replace("\\n","").replace("\\\"","").replace("\\","")
            
            stories = json.loads(repaired_json)
            logger.info("Successfully repaired and parsed JSON")
        except ImportError:
            logger.warning("json_repair not available, trying standard JSON parser")
            try:
                stories = json.loads(json_text)
                logger.info("Successfully parsed JSON with standard parser")
            except json.JSONDecodeError:
                logger.error("All JSON parsing attempts failed, using template")
                stories = template
        except Exception as e:
            logger.error(f"Error repairing JSON: {e}")
            stories = template
        
        return stories
    
    except Exception as e:
        logger.error(f"Error generating stories: {e}")
        logger.error(f"Failed response: {json_text if 'json_text' in locals() else 'No response'}")
        
        # Fall back to the template if we can't get a valid response
        logger.error("Failed To make paper")
        return template

def create_newspaper_json(articles, wizard_stories):
    """Create the final newspaper JSON combining real articles and wizard stories."""
    if not articles or not wizard_stories:
        return None
    
    try:
        newspaper = {
            "date": datetime.today().strftime('%m/%d/%Y'),
        }
        
        # Map articles and stories to the newspaper structure
        for i, article in enumerate(articles[:12]):
            if i >= len(articles):
                break
                
            key = get_article_key(i)
            if key not in wizard_stories:
                continue
                
            newspaper[key] = {
                "title": wizard_stories[key].get("title", ""),
                "article": wizard_stories[key].get("article", ""),
                "link": article.url,
                "image": article.top_image,
                "caption": wizard_stories[key].get("caption", "")
            }
        
        return newspaper
    
    except Exception as e:
        logger.error(f"Error creating newspaper JSON: {e}")
        return None

def update_paper_db():
    """Main function to update the newspaper content."""
    try:
        # Fetch and process articles
        articles = fetch_news_articles()
        if not articles:
            logger.error("Failed to fetch articles")
            return False
        
        # Prepare article summaries
        article_summaries = prepare_article_summaries(articles)
        if not article_summaries:
            logger.error("Failed to prepare article summaries")
            return False
        
        # Generate wizard stories
        wizard_stories = generate_wizard_stories(article_summaries)
        if not wizard_stories:
            logger.error("Failed to generate wizard stories")
            return False
        
        # Create newspaper JSON
        newspaper = create_newspaper_json(articles, wizard_stories)
        if not newspaper:
            logger.error("Failed to create newspaper JSON")
            return False
        
        # Save the newspaper JSON
        with open(SITE_JSON_PATH, 'w', encoding='utf8') as file:
            json.dump(newspaper, file, ensure_ascii=False, indent=2)
        
        logger.info(f"Successfully updated newspaper at {SITE_JSON_PATH}")
        return True
    
    except Exception as e:
        logger.error(f"Error updating paper: {e}")
        return False

@app.route('/updatepaper', methods=['GET'])
def update_paper():
    """API endpoint to trigger newspaper update."""
    # Check API key
    # api_key = request.headers.get('X-API-Key')
    # if not api_key or api_key != API_KEY:
    #     logger.warning("Invalid or missing API key")
    #     return jsonify({'error': 'Invalid or missing API key'}), 401
    
    # Try to update the paper
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        logger.info(f"Updating paper attempt {attempt}/{max_attempts}")
        if update_paper_db():
            return jsonify({'message': 'Paper updated successfully'})
        
    logger.error(f"Failed to update paper after {max_attempts} attempts")
    return jsonify({'error': f'Failed after {max_attempts} attempts. Contact Admin.'}), 500

@app.route('/', methods=['GET'])
def index():
    """Render the newspaper homepage."""
    try:
        with open(SITE_JSON_PATH, 'r', encoding='utf8') as file:
            articles = json.load(file)
        
        # Calculate issue number based on time
        issue = int((datetime.now() - datetime(1970, 1, 1)).total_seconds())
        
        # Add current year to template context
        current_year = datetime.now().year
        
        return render_template(
            'index.html',
            issue=issue,
            date=articles.get("date", ""),
            current_year=current_year,  # Add this line
            firststory=articles.get("firststory", {}),
            secondstory=articles.get("secondstory", {}),
            thirdstory=articles.get("thirdstory", {}),
            firstsubstory=articles.get("firstsubstory", {}),
            secondsubstory=articles.get("secondsubstory", {}),
            thirdsubstory=articles.get("thirdsubstory", {}),
            fourthsubstory=articles.get("fourthsubstory", {}),
            fifthsubstory=articles.get("fifthsubstory", {}),
            sixthsubstory=articles.get("sixthsubstory", {}),
            seventhsubstory=articles.get("seventhsubstory", {}),
            eighthsubstory=articles.get("eighthsubstory", {})
        )
    
    except Exception as e:
        logger.error(f"Error rendering index: {e}")
        return f"Error: {str(e)}", 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)