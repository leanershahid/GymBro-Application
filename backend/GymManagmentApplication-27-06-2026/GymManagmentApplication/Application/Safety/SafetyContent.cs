namespace GymManagmentApplication.Application.Safety;

/// <summary>
/// The standard pre-activity health questions, PAR-Q+ style (the seven general health questions),
/// reworded in plain language. Any "yes" means the member should get medical clearance before
/// starting or stepping up training. The question text is snapshotted with every submission.
/// </summary>
public static class HealthQuestionnaire
{
    public const string FormVersion = "parq-plus-style-v1";

    public static readonly HealthQuestionResponse[] Questions =
    [
        new() { Key = "heart_or_bp", Text = "Has a doctor ever told you that you have a heart condition or high blood pressure?" },
        new() { Key = "chest_pain", Text = "Do you feel pain in your chest when resting, during daily activities, or when you are active?" },
        new() { Key = "dizziness", Text = "Do you lose your balance because of dizziness, or have you lost consciousness in the last 12 months?",
                Help = "Answer no if your dizziness was only from breathing hard during exercise." },
        new() { Key = "chronic_condition", Text = "Have you ever been diagnosed with another long-term medical condition (other than heart disease or high blood pressure)?",
                Help = "For example diabetes, asthma, arthritis, cancer, osteoporosis, or a lung, kidney or liver condition." },
        new() { Key = "medication", Text = "Are you currently taking prescribed medication for a long-term medical condition?" },
        new() { Key = "bone_joint", Text = "Do you have (or have you had in the last 12 months) a bone, joint, muscle, ligament or tendon problem that could get worse with more activity?",
                Help = "Answer no if it was a problem in the past that doesn't limit you now." },
        new() { Key = "supervised_only", Text = "Has a doctor ever said you should only do medically supervised physical activity?" },
    ];
}

/// <summary>
/// Starting text offered when a gym creates its first waiver. It is a PLACEHOLDER, not legal advice:
/// the gym owner must have it reviewed by a lawyer for their jurisdiction before members sign it.
/// </summary>
public static class WaiverTemplate
{
    public const string Title = "Liability waiver and release";

    public const string Body = """
        [PLACEHOLDER TEMPLATE — HAVE THIS REVIEWED BY A LAWYER BEFORE USE. NOT LEGAL ADVICE.]

        ## 1. Assumption of risk
        I understand that exercise, including strength training, group classes, cardio and personal training, carries a risk of injury, illness and, in rare cases, death. I take part voluntarily and accept these risks.

        ## 2. Health
        I confirm that I have answered the gym's health questionnaire truthfully, that I will tell staff about any change in my health, and that I will stop exercising and tell staff if I feel unwell.

        ## 3. Rules and equipment
        I will follow the gym's rules and staff instructions, use equipment only as intended, and report damaged equipment.

        ## 4. Release
        To the extent allowed by law, I release [GYM LEGAL NAME], its owners, staff and trainers from claims arising from my use of the facilities and services, except where caused by their negligence or wilful misconduct.

        ## 5. Emergency treatment
        I consent to staff calling emergency services and giving first aid if I need it.

        ## 6. Personal belongings
        The gym is not responsible for lost or stolen belongings.

        ## 7. Agreement
        I have read this waiver, understand it, and sign it by typing my full name below.
        """;
}
