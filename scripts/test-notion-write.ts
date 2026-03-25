#!/usr/bin/env node
require('dotenv').config();

const token = process.env.NOTION_API_KEY;
const dbId = process.env.NOTION_INSIGHTS_DB_ID;

fetch('https://api.notion.com/v1/pages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: 'Test from Ronin Memory' } }] },
      Status: { select: { name: 'Proposed' } },
      Confidence: { number: 0.95 }
    }
  })
})
.then(res => res.json())
.then(data => {
  if (data.object === 'page') {
    console.log('Write test successful!');
    console.log('Page ID:', data.id);
    console.log('URL:', data.url);
  } else if (data.code === 'unauthorized') {
    console.log('Database not shared with integration');
    console.log('Action: Open database in Notion -> "..." -> "Add connections"');
  } else {
    console.log('Error:', data.message || JSON.stringify(data));
  }
})
.catch(err => console.log('Error:', err.message));
