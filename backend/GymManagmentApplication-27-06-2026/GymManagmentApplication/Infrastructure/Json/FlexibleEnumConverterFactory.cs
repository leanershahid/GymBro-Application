using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymManagmentApplication.Infrastructure.Json;

/// <summary>
/// Request bodies may send enums by name ("Inactive", case-insensitive) or by number.
/// Responses write numbers by default, so existing clients see no change.
/// <para>
/// ARCH-052 decision: the target is string output everywhere (shop enums already do this via
/// <c>[JsonConverter(typeof(JsonStringEnumConverter))]</c>). Flipping it is a breaking API change, so it
/// ships with the versioned API (ARCH-051): construct the factory with <c>writeAsString: true</c> for
/// the new version's serializer options, then drop the per-enum attributes and the pre-stringified
/// DTO fields (<c>Plan = t.Plan.ToString()</c>).
/// </para>
/// </summary>
public sealed class FlexibleEnumConverterFactory(bool writeAsString) : JsonConverterFactory
{
    public FlexibleEnumConverterFactory() : this(false) { }

    public bool WriteAsString { get; } = writeAsString;

    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(EnumConverter<>).MakeGenericType(typeToConvert), new object[] { WriteAsString })!; // not the (Type, bool nonPublic) overload

    private sealed class EnumConverter<T>(bool writeAsString) : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt64(out var n))
            {
                var value = (T)Enum.ToObject(typeof(T), n);
                if (Enum.IsDefined(value)) return value;
            }
            else if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (Enum.TryParse<T>(s, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)) return parsed;
            }
            throw new JsonException($"Choose one of: {string.Join(", ", Enum.GetNames<T>())}.");
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        {
            if (writeAsString) writer.WriteStringValue(value.ToString());
            else writer.WriteNumberValue(Convert.ToInt64(value));
        }
    }
}
