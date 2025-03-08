//Frontend: Bolt.new Implementation

// pages/index.js - Main dashboard page
import { useState, useEffect } from 'react';
import { NhostClient, NhostReactProvider, useAuth, useSignOut } from '@nhost/react';
import { gql, useQuery, useMutation } from '@apollo/client';
import { 
  Container, 
  Box, 
  Heading, 
  Text, 
  Button, 
  Flex, 
  Stack, 
  Badge, 
  Input, 
  Spinner,
  useColorModeValue,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar
} from '@chakra-ui/react';
import { ChevronDownIcon, SettingsIcon, BookmarkIcon, CheckIcon, ExternalLinkIcon } from 'lucide-react';

// Initialize Nhost client
const nhost = new NhostClient({
  subdomain: 'YOUR_NHOST_SUBDOMAIN',
  region: 'YOUR_NHOST_REGION'
});

// GraphQL queries and mutations
const GET_USER_PREFERENCES = gql`
  query GetUserPreferences($userId: uuid!) {
    user_preferences(where: {id: {_eq: $userId}}) {
      topics
      keywords
      preferred_sources
    }
  }
`;

const GET_PERSONALIZED_NEWS = gql`
  query GetPersonalizedNews($userId: uuid!, $topics: [String!]) {
    news_articles(
      where: {
        topics: {_overlaps: $topics},
        _not: {user_interactions: {user_id: {_eq: $userId}, is_read: {_eq: true}}}
      },
      order_by: {published_at: desc},
      limit: 20
    ) {
      id
      title
      url
      source
      published_at
      processed_articles {
        summary
        sentiment
        sentiment_explanation
      }
      user_interactions(where: {user_id: {_eq: $userId}}) {
        is_read
        is_saved
      }
    }
  }
`;

const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($userId: uuid!, $topics: [String!], $keywords: [String!], $preferred_sources: [String!]) {
    update_user_preferences(
      where: {id: {_eq: $userId}}, 
      _set: {
        topics: $topics, 
        keywords: $keywords, 
        preferred_sources: $preferred_sources,
        updated_at: "now()"
      }
    ) {
      affected_rows
    }
  }
`;

const UPDATE_USER_INTERACTION = gql`
  mutation UpdateUserInteraction($userId: uuid!, $articleId: uuid!, $isRead: Boolean, $isSaved: Boolean) {
    insert_user_interactions(
      objects: {
        user_id: $userId, 
        article_id: $articleId, 
        is_read: $isRead, 
        is_saved: $isSaved
      },
      on_conflict: {
        constraint: user_interactions_user_id_article_id_key,
        update_columns: [is_read, is_saved, updated_at]
      }
    ) {
      affected_rows
    }
  }
`;

// Main App component
function App() {
  const { isAuthenticated, user } = useAuth();
  const { signOut } = useSignOut();

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Flex justify="space-between" align="center" mb={8}>
        <Heading size="xl">NewsInsight</Heading>
        <Flex align="center">
          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
              <Avatar size="sm" name={user?.displayName} src={user?.avatarUrl} mr={2} />
              {user?.displayName || user?.email}
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => signOut()}>Sign Out</MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
      <Dashboard userId={user.id} />
    </Container>
  );
}

// Dashboard component
function Dashboard({ userId }) {
  const [activeTab, setActiveTab] = useState('feed');
  
  return (
    <Box>
      <Flex mb={6}>
        <Button 
          variant={activeTab === 'feed' ? 'solid' : 'ghost'} 
          onClick={() => setActiveTab('feed')}
          mr={4}
        >
          News Feed
        </Button>
        <Button 
          variant={activeTab === 'saved' ? 'solid' : 'ghost'} 
          onClick={() => setActiveTab('saved')}
          mr={4}
        >
          Saved Articles
        </Button>
        <Button 
          variant={activeTab === 'preferences' ? 'solid' : 'ghost'} 
          onClick={() => setActiveTab('preferences')}
        >
          Preferences
        </Button>
      </Flex>
      
      {activeTab === 'feed' && <NewsFeed userId={userId} isSavedOnly={false} />}
      {activeTab === 'saved' && <NewsFeed userId={userId} isSavedOnly={true} />}
      {activeTab === 'preferences' && <UserPreferences userId={userId} />}
    </Box>
  );
}

// News Feed component
function NewsFeed({ userId, isSavedOnly }) {
  const { data: preferencesData } = useQuery(GET_USER_PREFERENCES, {
    variables: { userId }
  });
  
  const topics = preferencesData?.user_preferences[0]?.topics || [];
  
  const { data, loading, error, refetch } = useQuery(GET_PERSONALIZED_NEWS, {
    variables: { userId, topics },
    skip: topics.length === 0
  });
  
  const [updateInteraction] = useMutation(UPDATE_USER_INTERACTION);
  
  const handleMarkAsRead = async (articleId) => {
    await updateInteraction({
      variables: {
        userId,
        articleId,
        isRead: true
      }
    });
    refetch();
  };
  
  const handleToggleSave = async (articleId, currentSaveStatus) => {
    await updateInteraction({
      variables: {
        userId,
        articleId,
        isSaved: !currentSaveStatus
      }
    });
    refetch();
  };
  
  if (loading) return <Spinner size="xl" />;
  if (error) return <Text>Error loading news: {error.message}</Text>;
  if (!data || topics.length === 0) return <Text>Set your preferences to see personalized news</Text>;
  
  let articles = data.news_articles;
  
  if (isSavedOnly) {
    articles = articles.filter(article => 
      article.user_interactions.length > 0 && article.user_interactions[0].is_saved
    );
  }
  
  if (articles.length === 0) {
    return <Text>{isSavedOnly ? "No saved articles yet" : "No new articles based on your preferences"}</Text>;
  }
  
  return (
    <Stack spacing={6}>
      {articles.map(article => (
        <NewsCard 
          key={article.id}
          article={article}
          onMarkAsRead={() => handleMarkAsRead(article.id)}
          onToggleSave={() => handleToggleSave(
            article.id, 
            article.user_interactions.length > 0 ? article.user_interactions[0].is_saved : false
          )}
        />
      ))}
    </Stack>
  );
}

// News Card component
function NewsCard({ article, onMarkAsRead, onToggleSave }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  const isSaved = article.user_interactions.length > 0 ? article.user_interactions[0].is_saved : false;
  const isRead = article.user_interactions.length > 0 ? article.user_interactions[0].is_read : false;
  
  const sentimentColor = 
    article.processed_articles[0]?.sentiment === 'positive' ? 'green' :
    article.processed_articles[0]?.sentiment === 'negative' ? 'red' : 'gray';
  
  return (
    <Box 
      p={5} 
      shadow="md" 
      borderWidth="1px" 
      borderRadius="md" 
      bg={bgColor}
      borderColor={borderColor}
      opacity={isRead ? 0.7 : 1}
    >
      <Flex justify="space-between" align="flex-start">
        <Box>
          <Heading fontSize="xl">{article.title}</Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            {article.source} • {new Date(article.published_at).toLocaleDateString()}
          </Text>
        </Box>
        <Badge colorScheme={sentimentColor} px={2} py={1} borderRadius="md">
          {article.processed_articles[0]?.sentiment}
        </Badge>
      </Flex>
      
      <Text mt={4}>{article.processed_articles[0]?.summary}</Text>
      
      <Text fontSize="sm" fontStyle="italic" mt={2} color={`${sentimentColor}.500`}>
        {article.processed_articles[0]?.sentiment_explanation}
      </Text>
      
      <Flex mt={4} justify="space-between">
        <Flex>
          <Button 
            size="sm" 
            leftIcon={<ExternalLinkIcon size={16} />}
            as="a" 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={onMarkAsRead}
            mr={2}
          >
            Read Full Article
          </Button>
          {!isRead && (
            <Button 
              size="sm" 
              leftIcon={<CheckIcon size={16} />}
              onClick={onMarkAsRead}
              variant="outline"
            >
              Mark as Read
            </Button>
          )}
        </Flex>
        <IconButton
          aria-label={isSaved ? "Unsave article" : "Save article"}
          icon={<BookmarkIcon size={16} fill={isSaved ? "currentColor" : "none"} />}
          onClick={onToggleSave}
          variant="ghost"
        />
      </Flex>
    </Box>
  );
}

// User Preferences component
function UserPreferences({ userId }) {
  const { data, loading, error } = useQuery(GET_USER_PREFERENCES, {
    variables: { userId }
  });
  
  const [topics, setTopics] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [preferredSources, setPreferredSources] = useState([]);
  const [newTopic, setNewTopic] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newSource, setNewSource] = useState('');
  
  const [updatePreferences, { loading: updating }] = useMutation(UPDATE_USER_PREFERENCES);
  
  useEffect(() => {
    if (data?.user_preferences[0]) {
      setTopics(data.user_preferences[0].topics || []);
      setKeywords(data.user_preferences[0].keywords || []);
      setPreferredSources(data.user_preferences[0].preferred_sources || []);
    }
  }, [data]);
  
  const handleAddTopic = () => {
    if (newTopic && !topics.includes(newTopic)) {
      setTopics([...topics, newTopic]);
      setNewTopic('');
    }
  };
  
  const handleAddKeyword = () => {
    if (newKeyword && !keywords.includes(newKeyword)) {
      setKeywords([...keywords, newKeyword]);
      setNewKeyword('');
    }
  };
  
  const handleAddSource = () => {
    if (newSource && !preferredSources.includes(newSource)) {
      setPreferredSources([...preferredSources, newSource]);
      setNewSource('');
    }
  };
  
  const handleRemoveTopic = (topic) => {
    setTopics(topics.filter(t => t !== topic));
  };
  
  const handleRemoveKeyword = (keyword) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };
  
  const handleRemoveSource = (source) => {
    setPreferredSources(preferredSources.filter(s => s !== source));
  };
  
  const handleSavePreferences = async () => {
    await updatePreferences({
      variables: {
        userId,
        topics,
        keywords,
        preferred_sources: preferredSources
      }
    });
  };
  
  if (loading) return <Spinner size="xl" />;
  if (error) return <Text>Error loading preferences: {error.message}</Text>;
  
  return (
    <Box>
      <Heading size="md" mb={4}>Your News Preferences</Heading>
      
      <Box mb={6}>
        <Heading size="sm" mb={2}>Topics</Heading>
        <Flex mb={2}>
          <Input 
            value={newTopic} 
            onChange={(e) => setNewTopic(e.target.value)} 
            placeholder="Add a topic (e.g., Technology, Politics)"
            mr={2}
          />
          <Button onClick={handleAddTopic}>Add</Button>
        </Flex>
        <Flex wrap="wrap" gap={2}>
          {topics.map(topic => (
            <Badge key={topic} p={2} borderRadius="md">
              {topic}
              <Button 
                size="xs" 
                ml={1} 
                onClick={() => handleRemoveTopic(topic)}
                variant="ghost"
              >
                ✕
              </Button>
            </Badge>
          ))}
        </Flex>
      </Box>
      
      <Box mb={6}>
        <Heading size="sm" mb={2}>Keywords</Heading>
        <Flex mb={2}>
          <Input 
            value={newKeyword} 
            onChange={(e) => setNewKeyword(e.target.value)} 
            placeholder="Add a keyword (e.g., AI, Climate Change)"
            mr={2}
          />
          <Button onClick={handleAddKeyword}>Add</Button>
        </Flex>
        <Flex wrap="wrap" gap={2}>
          {keywords.map(keyword => (
            <Badge key={keyword} p={2} borderRadius="md">
              {keyword}
              <Button 
                size="xs" 
                ml={1} 
                onClick={() => handleRemoveKeyword(keyword)}
                variant="ghost"
              >
                ✕
              </Button>
            </Badge>
          ))}
        </Flex>
      </Box>
      
      <Box mb={6}>
        <Heading size="sm" mb={2}>Preferred Sources</Heading>
        <Flex mb={2}>
          <Input 
            value={newSource} 
            onChange={(e) => setNewSource(e.target.value)} 
            placeholder="Add a news source (e.g., BBC, CNN)"
            mr={2}
          />
          <Button onClick={handleAddSource}>Add</Button>
        </Flex>
        <Flex wrap="wrap" gap={2}>
          {preferredSources.map(source => (
            <Badge key={source} p={2} borderRadius="md">
              {source}
              <Button 
                size="xs" 
                ml={1} 
                onClick={() => handleRemoveSource(source)}
                variant="ghost"
              >
                ✕
              </Button>
            </Badge>
          ))}
        </Flex>
      </Box>
      
      <Button 
        colorScheme="blue" 
        onClick={handleSavePreferences} 
        isLoading={updating}
      >
        Save Preferences
      </Button>
    </Box>
  );
}

// Authentication Page component
function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        const { error } = await nhost.auth.signUp({
          email,
          password,
          options: {
            displayName
          }
        });
        if (error) throw error;
      } else {
        const { error } = await nhost.auth.signIn({
          email,
          password
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Container maxW="md" py={12}>
      <Box p={8} shadow="lg" rounded="lg" bg={useColorModeValue('white', 'gray.800')}>
        <Heading textAlign="center" mb={6}>
          NewsInsight
        </Heading>
        <Heading size="md" textAlign="center" mb={6}>
          {isSignUp ? 'Create an Account' : 'Sign In'}
        </Heading>
        
        {error && (
          <Text color="red.500" mb={4} textAlign="center">
            {error}
          </Text>
        )}
        
        <form onSubmit={handleAuth}>
          {isSignUp && (
            <Box mb={4}>
              <Text mb={1}>Display Name</Text>
              <Input 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </Box>
          )}
          
          <Box mb={4}>
            <Text mb={1}>Email</Text>
            <Input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Box>
          
          <Box mb={6}>
            <Text mb={1}>Password</Text>
            <Input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Box>
          
          <Button 
            colorScheme="blue" 
            w="full" 
            type="submit"
            isLoading={isLoading}
            mb={4}
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>
          
          <Flex justify="center">
            <Button 
              variant="link" 
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </Flex>
        </form>
      </Box>
    </Container>
  );
}

// Root component
export default function Root() {
  return (
    <NhostReactProvider nhost={nhost}>
      <App />
    </NhostReactProvider>
  );
}
