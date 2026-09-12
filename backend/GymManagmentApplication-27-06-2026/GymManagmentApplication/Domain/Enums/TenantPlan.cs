namespace GymManagmentApplication.Domain.Enums;

public enum TenantPlan { Starter, Pro, Enterprise, WhiteLabel }
public enum TenantStatus { Active, Suspended, Trial, Cancelled }
public enum BranchStatus { Active, Inactive, ComingSoon }
public enum UserGender { Male, Female, Other, PreferNotToSay }
public enum UserStatus { Active, Inactive, Suspended, Pending }
public enum DeviceType { Web, Ios, Android, Desktop }
public enum BillingCycle { Daily, Weekly, Monthly, Quarterly, HalfYearly, Yearly, OneTime }
public enum MembershipStatus { Active, Expired, Cancelled, Paused, Trial, Pending }
public enum MembershipSource { Online, Pos, Import, Admin, Referral }
public enum CorporateStatus { Active, Inactive }
public enum InvoiceStatus { Draft, Sent, Paid, Overdue, Void, Refunded }
public enum PaymentMethod { Card, Upi, Netbanking, Cash, Cheque, Wallet, Crypto }
public enum PaymentStatus { Pending, Completed, Failed, Refunded }
public enum ExerciseCategory { Strength, Cardio, Flexibility, Balance, Sport, Rehab, Other }
public enum Difficulty { Beginner, Intermediate, Advanced, Elite }
public enum MuscleRole { Primary, Secondary, Stabilizer }
public enum WorkoutGoal { WeightLoss, MuscleGain, Endurance, Flexibility, General, Rehab, Sport }
public enum SectionType { Warmup, Main, Cooldown, Circuit, Superset, Dropset, Pyramid, Custom }
public enum AssignmentStatus { Assigned, InProgress, Completed, Skipped, Expired }
public enum DietGoal { WeightLoss, MuscleGain, Maintenance, Performance, Health }
public enum MealType { Breakfast, Lunch, Dinner, Snack, PreWorkout, PostWorkout }
public enum FitnessLevel { Beginner, Intermediate, Advanced, Athlete }
public enum MetricSource { Manual, Wearable, App, Trainer }
public enum HabitFrequency { Daily, Weekly, Custom }
public enum AttendanceMethod { Qr, Face, Biometric, Pin, Card, Manual }
public enum ClassStatus { Scheduled, InProgress, Completed, Cancelled }
public enum BookingStatus { Booked, Waitlisted, Attended, NoShow, Cancelled }
public enum LeadStatus { New, Contacted, Qualified, Proposal, Negotiation, Converted, Lost }
public enum LeadActivityType { Call, Email, Whatsapp, Sms, Visit, Note, StatusChange }
public enum AchievementType { Attendance, Workout, Goal, Streak, Challenge, Milestone }
public enum ChallengeType { Individual, Team, Branch }
public enum ChallengeStatus { Draft, Active, Completed, Cancelled }
public enum NotificationChannel { Email, Sms, Whatsapp, Push, InApp }
public enum NotificationStatus { Pending, Sent, Delivered, Failed, Read }
public enum AutomationLogStatus { Success, Failed, Skipped }
public enum ScheduledTaskStatus { Pending, Running, Completed, Failed }
public enum WebhookDeliveryStatus { Pending, Success, Failed }
public enum AiChatRole { User, Assistant, System }
public enum SupportTicketStatus { Open, InProgress, Waiting, Resolved, Closed }
public enum SupportPriority { Low, Medium, High, Urgent }
public enum CustomFieldType { Text, Number, Boolean, Date, Select, MultiSelect, File }
public enum TrainerAssignmentStatus { Active, Inactive, Paused }
public enum PtSessionStatus { Booked, Confirmed, InProgress, Completed, Cancelled, NoShow }
public enum TimeOffStatus { Pending, Approved, Rejected }
public enum FacilityEquipmentStatus { Operational, Maintenance, Retired, Reserved }
public enum MaintenanceType { Routine, Repair, Inspection, Upgrade, Replacement }
public enum EquipmentBookingStatus { Reserved, Active, Completed, Cancelled }
public enum LockerStatus { Available, Occupied, Maintenance, Reserved }
public enum AccessDeviceType { QrReader, FaceCam, Biometric, CardReader, PinPad }
public enum AccessEventType { Entry, Exit, Denied, Alarm }
public enum AccessMethod { Qr, Face, Biometric, Card, Pin, Manual }
public enum PosPaymentMethod { Cash, Card, Upi, Wallet, MembershipCredit }
public enum PosOrderStatus { Pending, Paid, Refunded, Cancelled }
public enum PayCycle { Weekly, BiWeekly, Monthly }
public enum PayrollStatus { Draft, Processing, Approved, Paid }
public enum PayrollSlipStatus { Draft, Approved, Paid }
public enum InjurySeverity { Minor, Moderate, Severe }
public enum VirtualSessionProvider { Zoom, GoogleMeet, Teams, Custom }
public enum VirtualSessionStatus { Scheduled, Live, Ended, Cancelled }
public enum SurveyType { Nps, Csat, Custom }
public enum CampaignType { Email, Sms, Whatsapp, Push }
public enum CampaignStatus { Draft, Scheduled, Running, Paused, Completed, Cancelled }
public enum GoalType { Weight, Strength, Endurance, Habit, BodyComposition, Custom }
public enum GoalStatus { Active, Achieved, Missed, Abandoned }
public enum PluginMinPlan { Starter, Pro, Enterprise, WhiteLabel }
public enum PricingAppliesTo { MembershipPlan, PtSession, Class, Product }
public enum PricingRuleType { TimeBased, UsageBased, SegmentBased, Promotional }
public enum PriceModifierType { Percentage, Fixed }
public enum ExportJobStatus { Queued, Processing, Ready, Failed, Expired }
public enum CommunicationChannel { Email, Sms, Whatsapp, Push }
public enum CommunicationDirection { Outbound, Inbound }
public enum CommunicationStatus { Queued, Sent, Delivered, Failed, Bounced, Opened, Clicked }
public enum ReferralStatus { Pending, Converted, Rewarded, Expired }
public enum CouponType { Percentage, Fixed, FreeTrial, Gift }

public enum SocialPostType { WorkoutShare, Achievement, Transformation, General }
