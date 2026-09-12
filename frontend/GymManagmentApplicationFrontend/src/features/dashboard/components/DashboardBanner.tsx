import React from 'react';
import { View, ImageBackground, ImageSourcePropType } from 'react-native';
import DashboardHeader from './Dashboardheader';
import { T } from '../../trainers/components/theme';

interface DashboardBannerProps {
  adminName: string;
  avatarUrl?: string;
  hasUnreadNotifications?: boolean;
  onPressNotifications?: () => void;
  onPressAvatar?: () => void;
  roleLabel?: string;
  image?: ImageSourcePropType;
}

const DEFAULT_IMAGE = require('../../../assets/dashboard/hero-athlete.jpg');

/**
 * Photo-backed wrapper around DashboardHeader — composes rather than
 * duplicates the greeting/avatar/bell logic already in DashboardHeader.
 */
export default function DashboardBanner({ image = DEFAULT_IMAGE, ...headerProps }: DashboardBannerProps) {
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
      <ImageBackground source={image} style={{ width: '100%' }} imageStyle={{ opacity: 0.55 }} resizeMode="cover">
        <View style={{ backgroundColor: 'rgba(10,15,10,0.45)', minHeight: 112, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 18 }}>
          <DashboardHeader {...headerProps} />
        </View>
      </ImageBackground>
    </View>
  );
}
