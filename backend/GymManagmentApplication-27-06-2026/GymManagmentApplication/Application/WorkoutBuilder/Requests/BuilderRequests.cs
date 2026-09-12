using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.WorkoutBuilder.Requests;

public class AddCircuitRequest
{
    public string? Name { get; set; }
    public byte Rounds { get; set; } = 3;
    public ushort? RestSeconds { get; set; }
    public List<ulong> ExerciseIds { get; set; } = [];
}

public class UpdateCircuitRequest
{
    public string? Name { get; set; }
    public byte? Rounds { get; set; }
    public ushort? RestSeconds { get; set; }
}

public class AddSupersetRequest
{
    public List<ulong> ExerciseIds { get; set; } = [];
    public ushort? RestSeconds { get; set; }
    public byte Sets { get; set; } = 3;
}

public class AddDropsetRequest
{
    public ulong ExerciseId { get; set; }
    public List<DropsetStep> Steps { get; set; } = [];
}

public class DropsetStep
{
    public string Weight { get; set; } = default!;
    public ushort Reps { get; set; }
}

public class AddPyramidRequest
{
    public ulong ExerciseId { get; set; }
    public string Direction { get; set; } = "ascending";
    public List<PyramidStep> Steps { get; set; } = [];
}

public class PyramidStep
{
    public string Weight { get; set; } = default!;
    public ushort Reps { get; set; }
}

public class SetTempoRequest
{
    public List<ulong> ExerciseIds { get; set; } = [];
    public string Tempo { get; set; } = default!;
}

public class SetRestIntervalsRequest
{
    public ushort DefaultRestSeconds { get; set; }
    public Dictionary<string, ushort>? SectionOverrides { get; set; }
}

public class ConfigureTimerRequest
{
    public string TimerType { get; set; } = "standard";
    public ushort? WorkSeconds { get; set; }
    public ushort? RestSeconds { get; set; }
    public byte? Rounds { get; set; }
}

public class SetDifficultyRequest
{
    public string Mode { get; set; } = "manual";
    public Difficulty BaseDifficulty { get; set; } = Difficulty.Beginner;
    public bool AutoAdjust { get; set; }
    public byte? ProgressionThresholdPercent { get; set; }
}
