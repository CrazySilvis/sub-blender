import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Subreddit Blender',
  height: 'tall',
  render: (context) => {
    const handleWebviewMessage = async (msg: any) => {
      if (msg.type === 'SEARCH_SUBREDDITS') {
        const query = msg.query;
        try {
          // 1. Search matching subreddits using Devvit server SDK
          const searchResults = await context.reddit.searchSubreddits({
            query: query,
            limit: 5,
          });

          // 2. Fetch official Subreddit model for each match to extract icon URLs
          const results = await Promise.all(
            searchResults.map(async (sub) => {
              try {
                const subData = await context.reddit.getSubredditByName(sub.name);
                return {
                  name: `r/${sub.name}`,
                  iconUrl: subData.iconUrl || subData.communityIcon || '',
                };
              } catch {
                return { name: `r/${sub.name}`, iconUrl: '' };
              }
            })
          );

          // 3. Send results back to the client webview
          context.ui.webView.postMessage('game-webview', {
            type: 'SEARCH_SUBREDDITS_RESPONSE',
            results,
          });
        } catch (err) {
          console.error('Failed to search subreddits:', err);
        }
      }
    };

    return (
      <vstack height="100%" width="100%">
        <webview
          id="game-webview"
          url="splash.html"
          onMessage={handleWebviewMessage}
          height="100%"
          width="100%"
        />
      </vstack>
    );
  },
});

export default Devvit;