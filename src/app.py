#!/usr/bin/python3.10
# -*- coding: utf-8 -*-

from flask import Flask
from flask import abort, render_template, request, jsonify, redirect, url_for, send_file, session

from newspaper import Article, build
import anthropic
from bs4 import BeautifulSoup
import pandas as pd
import requests

import json
import os
from datetime import datetime

from json_repair import repair_json
import json_repair

import re

app = Flask(__name__, static_folder='public', template_folder='views')

app.secret_key = os.environ.get('SECRET')

def get_stories_from_scraped(newsprompt1, newsprompt2): # [string,int]
    client = anthropic.Anthropic() # defaults to os.environ.get("ANTHROPIC_API_KEY")
    prompt = "For every user prompt, generate the following JSON format with a humorous, silly, highly creative, and imaginative explanation for the real-world event, attributing the cause to bizarre and unrelated wizard/witch activities, magical mishaps, fantastical creatures, and or any other fantasy based mage activies. The explanation should be an absurd, unintended consequence of wizard actions or magical phenomena that are entirely disconnected from the original context. Emphasize that wizards operate in a completelt separate reality from the mortal world, and their activities inadvertently affect mortal affairs in a comical, roundabout manner without any direct involvement or malicious intent. Ensure that the people in the stories are never portrayed as wizards themselves, but rather as ordinary individuals caught up in the ludicrous, tangential effects of the magical world's shenanigans. The explanations should be lighthearted, silly, and avoid any implications of wizards instigating serious real-world conflicts or controversies. Replace all words from the user prompt with new words that fit the new narrative. Articles must be at least 100 words. Create creative titles with clickbait and wizard intentions. Use backslashes (\\) before ANY double quotes (\") only double quotes within the JSON values. EVEN WHEN QUOTING SOMETHING FROM THE ARTICLE. No backslashes are needed before single quotes. CAPTIONS MUST BE 10 WORDS OR LESS. THE GENERATED JSON FORMAT MUST BE VALID AND LOADABLE. NO INVALID CHARACTERS OR WHITESPACES WITHIN THE JSON. ONLY RETURN THE JSON FORMAT."
    storyformater1="{\"firststory\":{\"title\":\"\",\"article\":\"\",\"caption\":\"\"},\"secondstory\":{\"title\":\"\",\"article\":\"\"},\"thirdstory\":{\"title\":\"\",\"article\":\"\"},\"firstsubstory\":{\"title\":\"\",\"article\":\"\"},\"secondsubstory\":{\"title\":\"\",\"article\":\"\"},\"thirdsubstory\":{\"title\":\"\",\"article\":\"\"}}"
    storyformater2="{\"fourthsubstory\":{\"title\":\"\",\"article\":\"\"},\"fifthsubstory\":{\"title\":\"\",\"article\":\"\"},\"sixthsubstory\":{\"title\":\"\",\"article\":\"\"},\"seventhsubstory\":{\"title\":\"\",\"article\":\"\"},\"eighthsubstory\":{\"title\":\"\",\"article\":\"\"}}"
    newsprompt = [newsprompt1,newsprompt2]
    storyformater = [storyformater1,storyformater2]
    messages = ["",""]
    for i in range(2):
        messages[i] = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=4096,
            temperature=0.37,
            system=f"{prompt}\n\n{storyformater[i]}",
            messages=[
                {
                    "role": "user",
                    "content": newsprompt[i]
                }
            ]
        ).content[0].text
    print(messages[0][:-1] + "," + messages[1][1:])
    return (messages[0][:-1] + "," + messages[1][1:])

def build_AIprompt_json():
    # Build the newspaper source
    url = 'https://apnews.com/oddities'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
    response = requests.get(url, headers=headers)
    html_content = response.content
    soup = BeautifulSoup(html_content, 'html.parser')
    article_links = [a_tag.get('href') for link in soup.find('main').find_all('bsp-custom-headline')[:13]if (a_tag := link.find('a', class_="Link")) and a_tag.get('href')]
    articles = []
    # Download and parse the articles
    for link in article_links:
        article = Article(link)
        article.download()
        article.parse()
        articles.append(article)

    # Fill in the first dictionary
    newsprompt1 = f""" 
        firststory: {" ".join(articles[0].text.split("—")[1:])[:400]} 
        secondstory: {" ".join(articles[1].text.split("—")[1:])[:400]} 
        thirdstory: {" ".join(articles[2].text.split("—")[1:])[:400]} 
        firstsubstory: {" ".join(articles[3].text.split("—")[1:])[:400]} 
        secondsubstory: {" ".join(articles[4].text.split("—")[1:])[:400]} 
        thirdsubstory: {" ".join(articles[5].text.split("—")[1:])[:400]} 
    """
    newsprompt2 = f""" 
        fourthsubstory: {" ".join(articles[6].text.split("—")[1:])[:400]} 
        fifthsubstory: {" ".join(articles[7].text.split("—")[1:])[:400]} 
        sixthsubstory: {" ".join(articles[8].text.split("—")[1:])[:400]} 
        seventhsubstory: {" ".join(articles[10].text.split("—")[1:])[:400]} 
        eighthsubstory: {" ".join(articles[11].text.split("—")[1:])[:400]} 
    """

    return articles, newsprompt1, newsprompt2

def build_website_json(articles, newsprompt1, newsprompt2):
    AIJson = get_stories_from_scraped(newsprompt1, newsprompt2)
    AIStories = json_repair.loads(AIJson)
    # Fill in the second dictionary
    Articles = {
        "date": datetime.today().strftime('%m/%d/%Y'),
        "firststory": {
            "title": AIStories["firststory"]["title"],
            "article": AIStories["firststory"]["article"],
            "link": articles[0].url,
            "image": articles[0].top_image,
            "caption": AIStories["firststory"]["caption"]
        },
        "secondstory": {
            "link": articles[1].url,
            "image": articles[1].top_image,
            "title": AIStories["secondstory"]["title"],
            "article": AIStories["secondstory"]["article"]
        },
        "thirdstory": {
            "link": articles[2].url,
            "image": articles[2].top_image,
            "title": AIStories["thirdstory"]["title"],
            "article": AIStories["thirdstory"]["article"]
        },
        "firstsubstory": {
            "link": articles[3].url,
            "title": AIStories["firstsubstory"]["title"],
            "article": AIStories["firstsubstory"]["article"]
        },
        "secondsubstory": {
            "link": articles[4].url,
            "title": AIStories["secondsubstory"]["title"],
            "article": AIStories["secondsubstory"]["article"]
        },
        "thirdsubstory": {
            "link": articles[5].url,
            "title": AIStories["thirdsubstory"]["title"],
            "article": AIStories["thirdsubstory"]["article"]
        },
        "fourthsubstory": {
            "link": articles[6].url,
            "image": articles[6].top_image,
            "title": AIStories["fourthsubstory"]["title"],
            "article": AIStories["fourthsubstory"]["article"]
        },
        "fifthsubstory": {
            "link": articles[7].url,
            "title": AIStories["fifthsubstory"]["title"],
            "article": AIStories["fifthsubstory"]["article"]
        },
        "sixthsubstory": {
            "link": articles[8].url,
            "title": AIStories["sixthsubstory"]["title"],
            "article": AIStories["sixthsubstory"]["article"]
        },
        "seventhsubstory": {
            "link": articles[10].url,
            "image": articles[10].top_image,
            "title": AIStories["seventhsubstory"]["title"],
            "article": AIStories["seventhsubstory"]["article"]
        },
        "eighthsubstory": {
            "link": articles[11].url,
            "image": articles[11].top_image,
            "title": AIStories["eighthsubstory"]["title"],
            "article": AIStories["eighthsubstory"]["article"]
        }
    }
    return Articles

def update_paper_db():
    try:
        article,prompt1,prompt2 = build_AIprompt_json()
        websitejson = build_website_json(article,prompt1,prompt2)
        with open('C:/Users/wkeif/Desktop/ArcaneObserver/src/public/site.json', 'w', encoding ='utf8') as site_file: 
            json.dump(websitejson, site_file, ensure_ascii = False)
        return True
    except Exception as e:
        print(e)
        return False
    

# curl -X GET -H "X-API-Key: key" http://arcaneobserver.com/updatepaper
@app.route('/updatepaper', methods=['GET'])
def update_paper():
    if request.remote_addr != '127.0.0.1':
        return jsonify({'error': 'Unauthorized access'}), 401

    if 'X-API-Key' not in request.headers:
        return jsonify({'error': 'Missing API key'}), 401

    api_key = request.headers['X-API-Key']
    
    if api_key != os.environ.get('NEW_STORY_KEY'):
        return jsonify({'error': 'Invalid API key'}), 401

    numOfTries = 0
    tryGetPaper = False
    while not tryGetPaper and numOfTries < 5:
        tryGetPaper = update_paper_db()
        if numOfTries == 4:
            return jsonify({'error': f'Failed after 5 times. Contact Admin.'}), 401
        numOfTries+=1
        
    return jsonify({'message': 'Paper updated successfully'})

@app.route('/', methods=['GET'])
def index():
    with open('C:/Users/wkeif/Desktop/ArcaneObserver/src/public/site.json', 'r', encoding ='utf8') as site_file: 
        articles = json.load(site_file)
    return render_template('index.html',issue = int((datetime.now() - datetime(1970, 1, 1)).total_seconds()),date=articles["date"],firststory=articles["firststory"],secondstory=articles["secondstory"],thirdstory=articles["thirdstory"],firstsubstory=articles["firstsubstory"],secondsubstory=articles["secondsubstory"],thirdsubstory=articles["thirdsubstory"],fourthsubstory=articles["fourthsubstory"],fifthsubstory=articles["fifthsubstory"],sixthsubstory=articles["sixthsubstory"],seventhsubstory=articles["seventhsubstory"],eighthsubstory=articles["eighthsubstory"])

# @app.route('/debug', methods=['GET'])
# def debug():
#     update_paper_db()
#     return ""

if __name__ == '__main__':
    app.run(debug=True)
