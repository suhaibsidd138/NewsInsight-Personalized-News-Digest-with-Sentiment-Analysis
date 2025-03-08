# NewsInsight-Personalized-News-Digest-with-Sentiment-Analysis


Based on the code I've provided, here's a comprehensive description of the personalized news digest website solution:

## Overview
NewsInsight is a web application that delivers personalized news content with AI-powered summaries and sentiment analysis. The platform allows users to customize their news feed based on topics of interest, keywords, and preferred sources. Each article is processed through an AI model that generates concise summaries and provides sentiment analysis insights.

## Architecture Components

### Backend (Nhost)
The solution utilizes Nhost for backend services including:
- **Authentication**: User registration and login functionality
- **Database**: PostgreSQL database to store user preferences, news articles, and processed content
- **GraphQL API**: Interface for data access and manipulation

The database schema includes:
- `user_preferences`: Stores user-specific topics, keywords, and preferred news sources
- `news_articles`: Contains raw article data including title, URL, source, and content
- `processed_articles`: Stores AI-generated summaries and sentiment analysis for each article
- `user_interactions`: Tracks user interactions with articles (read/saved status)

### Frontend (Bolt.new)
The frontend is built with React using Bolt.new and features:
- **User Authentication**: Login/registration screens with form validation
- **Personalized Dashboard**: Displays news articles filtered by user preferences
- **Preference Management**: Interface for users to add/remove topics, keywords, and sources
- **Article Cards**: Display article summaries with sentiment indicators using color-coded badges

The UI components follow a clean design pattern with:
- Responsive layout suitable for various screen sizes
- Color-coded sentiment indicators (green for positive, red for negative, gray for neutral)
- Interactive elements for saving articles and marking them as read

### N8N Workflow
The automation workflow runs on an n8n server and handles:
1. **Scheduled Trigger**: Runs hourly to fetch new content
2. **User Preferences Retrieval**: Queries the database for all user preferences
3. **News Fetching**: Connects to a free news API to retrieve articles matching user topics and keywords
4. **Article Processing**: Saves raw articles to the database
5. **AI Analysis**: Sends article content to OpenRouter (using the Claude model) for summarization and sentiment analysis
6. **Database Update**: Stores the processed summaries and sentiment data back in the Nhost database

## Key Features

### For Users
- **Personalized Content**: Articles filtered by user-defined preferences
- **Concise Summaries**: AI-generated summaries that capture the essence of each article
- **Sentiment Insights**: Color-coded sentiment indicators with explanations
- **Article Management**: Ability to mark articles as read or save them for later
- **Preference Customization**: Easy interface to add/remove topics, keywords, and sources

### Technical Highlights
- **Scalable Architecture**: Separation of concerns between database, API, and automation
- **Real-time Updates**: GraphQL subscriptions enable instant updates to the user interface
- **AI Integration**: Leverages OpenRouter to access advanced language models for content processing
- **Conflict Resolution**: Handles duplicate articles gracefully with on-conflict update rules
- **Responsive Design**: Adaptive UI that works across different devices

## Implementation Notes
- The frontend uses Chakra UI components for a consistent design system
- Authentication is handled directly by Nhost services
- The n8n workflow is designed to process articles in batches to avoid rate limits
- Sentiment analysis is categorized as positive, negative, or neutral with explanatory text
- The application stores article interactions to personalize future content delivery

This solution combines modern tools and services to create a seamless user experience for consuming personalized news content enhanced with AI-powered insights.
