{
  "nodes": [
    {
      "id": "1",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.schedule",
      "typeVersion": 1,
      "position": [
        250,
        300
      ],
      "parameters": {
        "triggerTimes": {
          "item": [
            {
              "mode": "everyX",
              "value": 1,
              "unit": "hours"
            }
          ]
        }
      }
    },
    {
      "id": "2",
      "name": "Fetch User Preferences",
      "type": "n8n-nodes-base.graphql",
      "typeVersion": 1,
      "position": [
        450,
        300
      ],
      "credentials": {
        "graphql": "Nhost GraphQL"
      },
      "parameters": {
        "endpoint": "=https://{{$credentials.subdomain}}.{{$credentials.region}}.nhost.run/v1/graphql",
        "requestFormat": "json",
        "query": "query GetAllUserPreferences {\n  user_preferences {\n    id\n    topics\n    keywords\n    preferred_sources\n  }\n}"
      }
    },
    {
      "id": "3",
      "name": "Split Users",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 1,
      "position": [
        650,
        300
      ],
      "parameters": {
        "batchSize": 1,
        "options": {
          "includeBatchIndex": true
        }
      }
    },
    {
      "id": "4",
      "name": "News API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 2,
      "position": [
        850,
        300
      ],
      "parameters": {
        "url": "=https://newsapi.org/v2/everything",
        "method": "GET",
        "authentication": "genericCredentialType",
        "genericAuthType": "queryAuth",
        "queryParameters": {
          "parameters": [
            {
              "name": "apiKey",
              "value": "{{$credentials.apiKey}}"
            },
            {
              "name": "q",
              "value": "={{$json.topics.join(\" OR \") + \" OR \" + $json.keywords.join(\" OR \")}}"
            },
            {
              "name": "language",
              "value": "en"
            },
            {
              "name": "pageSize",
              "value": "10"
            },
            {
              "name": "sortBy",
              "value": "publishedAt"
            }
          ]
        },
        "options": {}
      },
      "credentials": {
        "genericCredentialType": "News API"
      }
    },
    {
      "id": "5",
      "name": "Process Articles",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [
        1050,
        300
      ],
      "parameters": {
        "functionCode": "// Get user preferences and articles\nconst userPreferences = items[0].json;\nconst articles = items[0].json.articles || [];\n\n// Extract user ID\nconst userId = userPreferences.id;\n\n// Process and filter articles\nconst processedArticles = articles.map(article => {\n  return {\n    userId,\n    title: article.title,\n    url: article.url,\n    source: article.source.name,\n    published_at: article.publishedAt,\n    content: article.content || article.description,\n    topics: userPreferences.topics,\n    raw_article: article\n  };\n});\n\n// Return processed articles\nif (processedArticles.length === 0) {\n  return [{json: {userId, message: 'No articles found'}}];\n}\n\nreturn processedArticles.map(article => ({json: article}));"
      }
    },
    {
      "id": "6",
      "name": "Insert Raw Articles",
      "type": "n8n-nodes-base.graphql",
      "typeVersion": 1,
      "position": [
        1250,
        300
      ],
      "credentials": {
        "graphql": "Nhost GraphQL"
      },
      "parameters": {
        "endpoint": "=https://{{$credentials.subdomain}}.{{$credentials.region}}.nhost.run/v1/graphql",
        "requestFormat": "json",
        "query": "mutation InsertArticle($title: String!, $url: String!, $source: String!, $published_at: timestamptz!, $content: String!, $topics: _text!) {\n  insert_news_articles_one(\n    object: {\n      title: $title,\n      url: $url,\n      source: $source,\n      published_at: $published_at,\n      content: $content,\n      topics: $topics\n    },\n    on_conflict: {\n      constraint: news_articles_url_key,\n      update_columns: [title, source, content, topics]\n    }\n  ) {\n    id\n    title\n  }\n}",
        "variables": "{\n  \"title\": \"{{$json.title}}\",\n  \"url\": \"{{$json.url}}\",\n  \"source\": \"{{$json.source}}\",\n  \"published_at\": \"{{$json.published_at}}\",\n  \"content\": \"{{$json.content}}\",\n  \"topics\": \"{{JSON.stringify($json.topics)}}\"\n}"
      }
    },
    {
      "id": "7",
      "name": "OpenRouter API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 2,
      "position": [
        1450,
        300
      ],
      "parameters": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "httpHeaderAuth": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{$credentials.apiKey}}"
            },
            {
              "name": "HTTP-Referer",
              "value": "https://newsinsight.app"
            },
            {
              "name": "X-Title",
              "value": "NewsInsight App"
            }
          ]
        },
        "bodyParameters": {
          "parameters": [
            {
              "name": "model",
              "value": "anthropic/claude-3-haiku"
            },
            {
              "name": "messages",
              "value": "=[\n  {\n    \"role\": \"system\",\n    \"content\": \"You are an expert news analyst. Your task is to summarize news articles and analyze their sentiment (positive, negative, or neutral). Provide a concise summary (max 2-3 sentences) and a brief explanation of the sentiment.\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"Please analyze this news article:\\n\\nTitle: {{$json.title}}\\n\\nContent: {{$json.content}}\\n\\nProvide your response in JSON format with the following structure:\\n{\\\"summary\\\": \\\"concise summary here\\\", \\\"sentiment\\\": \\\"positive/negative/neutral\\\", \\\"sentiment_explanation\\\": \\\"brief explanation of sentiment\\\"}\"\n  }\n]"
            },
            {
              "name": "max_tokens",
              "value": 1000
            }
          ]
        },
        "options": {}
      },
      "credentials": {
        "genericCredentialType": "OpenRouter API"
      }
    },
    {
      "id": "8",
      "name": "Process AI Response",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [
        1650,
        300
      ],
      "parameters": {
        "functionCode": "// Get the article data and AI response\nconst articleData = items[0].json;\nconst aiResponse = items[1].json;\n\n// Extract article ID\nconst articleId = articleData.data?.insert_news_articles_one?.id;\nconst userId = articleData.userId;\n\n// Parse AI response\nlet processedContent;\ntry {\n  const responseText = aiResponse.choices[0].message.content;\n  // Try to extract JSON from response\n  const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);\n  if (jsonMatch) {\n    processedContent = JSON.parse(jsonMatch[0]);\n  } else {\n    throw new Error('No JSON found in response');\n  }\n} catch (error) {\n  // Fallback if parsing fails\n  processedContent = {\n    summary: \"Failed to process article content.\",\n    sentiment: \"neutral\",\n    sentiment_explanation: \"Could not determine sentiment due to processing error.\"\n  };\n}\n\n// Return the processed data\nreturn [{\n  json: {\n    articleId,\n    userId,\n    summary: processedContent.summary,\n    sentiment: processedContent.sentiment,\n    sentiment_explanation: processedContent.sentiment_explanation\n  }\n}];"
      }
    },
    {
      "id": "9",
      "name": "Store Processed Article",
      "type": "n8n-nodes-base.graphql",
      "typeVersion": 1,
      "position": [
        1850,
        300
      ],
      "credentials": {
        "graphql": "Nhost GraphQL"
      },
