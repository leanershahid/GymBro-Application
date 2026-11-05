namespace GymManagmentApplication.Domain.Enums;

// Leads, challenges, notifications, communication and social.

public enum LeadStatus { New, Contacted, Qualified, Proposal, Negotiation, Converted, Lost }
public enum LeadActivityType { Call, Email, Whatsapp, Sms, Visit, Note, StatusChange }
public enum ChallengeType { Individual, Team, Branch }
public enum ChallengeStatus { Draft, Active, Completed, Cancelled }
public enum NotificationChannel { Email, Sms, Whatsapp, Push, InApp }
public enum NotificationStatus { Pending, Sent, Delivered, Failed, Read }
public enum CommunicationChannel { Email, Sms, Whatsapp, Push }
public enum CommunicationDirection { Outbound, Inbound }
public enum CommunicationStatus { Queued, Sent, Delivered, Failed, Bounced, Opened, Clicked }
public enum SocialPostType { WorkoutShare, Achievement, Transformation, General }
