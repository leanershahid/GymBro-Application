import React, { useState } from 'react';
import { View } from 'react-native';
import Screen from '../common/components/Screen';
import ScreenHeader from '../common/components/ScreenHeader';
import SocialFeed from './components/SocialFeed';
import CreatePostModal from './components/CreatePostModal';

/**
 * The social module: a feed of the gym's photo posts with likes and comments, and a "+" to post.
 * Used by the member app and, with a back button, by the admin app.
 */
export default function SocialApp({ onBack }: { onBack?: () => void }) {
  const [creating, setCreating] = useState(false);

  return (
    <Screen>
      <ScreenHeader
        title="Social"
        eyebrow="Your gym"
        onBack={onBack}
        action={{ label: 'Post', icon: 'plus', onPress: () => setCreating(true) }}
      />
      <View style={{ flex: 1 }}>
        <SocialFeed onCreate={() => setCreating(true)} />
      </View>
      <CreatePostModal visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
